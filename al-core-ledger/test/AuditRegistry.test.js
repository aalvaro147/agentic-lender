const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AuditRegistry", function () {
  async function deploy() {
    const [admin, auditor, outsider] = await ethers.getSigners();
    const registry = await ethers.deployContract("AuditRegistry");
    await registry.waitForDeployment();
    await registry.grantRole(await registry.AUDITOR_ROLE(), auditor.address);
    return { registry, admin, auditor, outsider };
  }

  it("records an immutable hash and its submitter", async function () {
    const { registry, auditor } = await deploy();
    const applicationId = ethers.id("APP-10042");
    const memoHash = ethers.sha256(ethers.toUtf8Bytes("approved credit memo"));

    await expect(registry.connect(auditor).recordAuditHash(applicationId, memoHash))
      .to.emit(registry, "AuditLogged");

    const record = await registry.auditRecords(applicationId);
    expect(record.sha256Hash).to.equal(memoHash);
    expect(record.committedBy).to.equal(auditor.address);
    expect(await registry.auditExists(applicationId)).to.equal(true);
  });

  it("rejects duplicate records and zero identifiers or hashes", async function () {
    const { registry, auditor } = await deploy();
    const applicationId = ethers.id("APP-10042");
    const memoHash = ethers.sha256(ethers.toUtf8Bytes("approved credit memo"));

    await registry.connect(auditor).recordAuditHash(applicationId, memoHash);
    await expect(
      registry.connect(auditor).recordAuditHash(applicationId, memoHash),
    ).to.be.revertedWith("Audit record already exists");
    await expect(
      registry.connect(auditor).recordAuditHash(ethers.ZeroHash, memoHash),
    ).to.be.revertedWith("Application ID cannot be zero");
    await expect(
      registry.connect(auditor).recordAuditHash(ethers.id("APP-2"), ethers.ZeroHash),
    ).to.be.revertedWith("Audit hash cannot be zero");
  });

  it("restricts commits to the auditor role", async function () {
    const { registry, outsider } = await deploy();
    await expect(
      registry.connect(outsider).recordAuditHash(ethers.id("APP-1"), ethers.id("memo")),
    ).to.be.reverted;
  });
});
