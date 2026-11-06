const fs = require("node:fs");
const path = require("node:path");
const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const apiSigner = process.env.API_SIGNER_ADDRESS
    ? ethers.getAddress(process.env.API_SIGNER_ADDRESS)
    : deployer.address;

  const AuditRegistry = await ethers.getContractFactory("AuditRegistry");
  const auditRegistry = await AuditRegistry.deploy();
  await auditRegistry.waitForDeployment();

  const LoanToken = await ethers.getContractFactory("LoanToken");
  const loanToken = await LoanToken.deploy();
  await loanToken.waitForDeployment();

  if (apiSigner !== deployer.address) {
    await (await auditRegistry.grantRole(await auditRegistry.AUDITOR_ROLE(), apiSigner)).wait();
    await (await loanToken.grantRole(await loanToken.MINTER_ROLE(), apiSigner)).wait();
  }

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    apiSigner,
    auditRegistry: await auditRegistry.getAddress(),
    loanToken: await loanToken.getAddress(),
    deployedAt: new Date().toISOString(),
  };
  const deploymentDirectory = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentDirectory, `${network.name}.json`),
    `${JSON.stringify(deployment, null, 2)}\n`,
    { flag: "w" },
  );

  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
