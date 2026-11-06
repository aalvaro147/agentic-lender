const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LoanToken", function () {
  async function deploy() {
    const [admin, minter, borrower, outsider] = await ethers.getSigners();
    const loanToken = await ethers.deployContract("LoanToken");
    await loanToken.waitForDeployment();
    await loanToken.grantRole(await loanToken.MINTER_ROLE(), minter.address);
    return { loanToken, admin, minter, borrower, outsider };
  }

  async function mint(loanToken, minter, borrower, overrides = {}) {
    return loanToken.connect(minter).mintLoanToken(
      overrides.to || borrower.address,
      overrides.tokenId ?? 1,
      overrides.principal ?? 350_000_00,
      overrides.baseAprBps ?? 350,
      overrides.termMonths ?? 360,
      overrides.borrowerHash || ethers.id("borrower-1"),
      overrides.berRating || "A2",
    );
  }

  it("mints a loan note with a 25-basis-point discount for BER A1-A3", async function () {
    const { loanToken, minter, borrower } = await deploy();
    await expect(mint(loanToken, minter, borrower))
      .to.emit(loanToken, "LoanMinted")
      .withArgs(1, ethers.id("borrower-1"), 325);

    const note = await loanToken.loanNotes(1);
    expect(await loanToken.ownerOf(1)).to.equal(borrower.address);
    expect(note.principal).to.equal(350_000_00);
    expect(note.aprBps).to.equal(325);
    expect(note.termMonths).to.equal(360);
    expect(note.berRating).to.equal("A2");
  });

  it("does not discount ineligible BER ratings and floors the APR at zero", async function () {
    const { loanToken, minter, borrower } = await deploy();
    await mint(loanToken, minter, borrower, { tokenId: 2, berRating: "B1" });
    await mint(loanToken, minter, borrower, { tokenId: 3, baseAprBps: 10 });

    expect((await loanToken.loanNotes(2)).aprBps).to.equal(350);
    expect((await loanToken.loanNotes(3)).aprBps).to.equal(0);
  });

  it("rejects invalid loan terms and unsupported BER ratings", async function () {
    const { loanToken, minter, borrower } = await deploy();
    await expect(mint(loanToken, minter, borrower, { principal: 0 }))
      .to.be.revertedWith("Principal must be positive");
    await expect(mint(loanToken, minter, borrower, { termMonths: 0 }))
      .to.be.revertedWith("Invalid loan term");
    await expect(mint(loanToken, minter, borrower, { berRating: "NOT-A-BER" }))
      .to.be.revertedWith("Unsupported BER rating");
    await expect(mint(loanToken, minter, borrower, { tokenId: 4, to: ethers.ZeroAddress }))
      .to.be.revertedWith("Recipient cannot be zero");
  });

  it("restricts minting to the minter role and rejects duplicate token IDs", async function () {
    const { loanToken, minter, borrower, outsider } = await deploy();
    await expect(
      loanToken.connect(outsider).mintLoanToken(
        borrower.address, 1, 100_00, 300, 120, ethers.id("borrower-1"), "B1",
      ),
    ).to.be.reverted;
    await mint(loanToken, minter, borrower);
    await expect(mint(loanToken, minter, borrower)).to.be.reverted;
  });
});

const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
