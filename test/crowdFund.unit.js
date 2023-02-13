const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("ethers/lib/utils");

const NFT_NAME = "TokenName";
const NFT_SYMBOL = "TKN";
const INIT_BAL = parseEther("1");
const EXCEED_BAL = parseEther("2");
const GOAL = parseEther("1");
// const timeNow = () => Math.ceil(new Date().getTime() / 1000);
const timeNow = async () => {
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const timestampBefore = blockBefore.timestamp;
  return timestampBefore;
};
const getStartAt = async () => (await timeNow()) + 1000;
const getEndAt = async () => (await timeNow()) + 5000;

describe("NFT Token", function () {
  let owner, crowdFundContract, projectTreasury, author, other, token;

  beforeEach(async () => {
    [owner, user2, user3, ...addrs] = await ethers.getSigners();
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock", owner);
    token = await ERC20Mock.deploy(
      NFT_NAME,
      NFT_SYMBOL,
      owner.address,
      INIT_BAL
    );

    await token.deployed();
    await token.mint(user2.address, INIT_BAL);
    await token.mint(user3.address, INIT_BAL);

    const ERC20CrowdFund = await ethers.getContractFactory(
      "ERC20CrowdFund",
      owner
    );
    crowdFundContract = await ERC20CrowdFund.deploy(token.address);
  });
  describe("Setup", function () {
    it("should have initial balance of token", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(INIT_BAL);
      expect(await token.balanceOf(user2.address)).to.equal(INIT_BAL);
      expect(await token.balanceOf(user3.address)).to.equal(INIT_BAL);
    });

    it("should set token in crowd fund contract", async function () {
      expect(await crowdFundContract.token()).to.equal(token.address);
    });
  });
  describe("Launch", function () {
    it("should successfully launch", async function () {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await crowdFundContract.launch(GOAL, startAt, endAt);
      const c = await crowdFundContract.campaigns(0);
      expect(c.goal).to.equal(GOAL);
      expect(c.startAt).to.equal(startAt);
      expect(c.endAt).to.equal(endAt);
    });
    it("startAt < endAt", async function () {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await expect(
        crowdFundContract.launch(GOAL, endAt, startAt)
      ).to.be.revertedWith("ERC20CrowdFund__StartAtShouldLessThanEndAt");
    });

    it("startAt < now", async function () {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await expect(
        crowdFundContract.launch(GOAL, startAt - 10000, endAt)
      ).to.be.revertedWith("ERC20CrowdFund__StartAtShouldGreaterThanNow");
    });

    it("endAt exceed max period", async function () {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await expect(
        crowdFundContract.launch(GOAL, startAt, endAt + 86400 * 7)
      ).to.be.revertedWith("ERC20CrowdFund__EndAtExceedMaxPeriod");
    });
  });
  describe("Pledge", function () {
    beforeEach(async () => {});

    it("pledge before compaign started", async function () {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await crowdFundContract.launch(GOAL, startAt, endAt);
      await token.connect(user2).approve(crowdFundContract.address, INIT_BAL);

      await expect(
        crowdFundContract.connect(user2).pledge(0, INIT_BAL)
      ).to.be.revertedWith("ERC20CrowdFund__CampaignNotStarted");
    });
    it("pledge when compaign ended", async function () {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await crowdFundContract.launch(GOAL, startAt, endAt);
      await token.connect(user2).approve(crowdFundContract.address, INIT_BAL);

      await ethers.provider.send("evm_increaseTime", [5000]);
      await ethers.provider.send("evm_mine");
      await expect(
        crowdFundContract.connect(user2).pledge(0, INIT_BAL)
      ).to.be.revertedWith("ERC20CrowdFund__CampaignEnded");
    });
    it("should successfully pledge", async function () {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await crowdFundContract.launch(GOAL, startAt, endAt);
      await ethers.provider.send("evm_increaseTime", [1000]);
      await ethers.provider.send("evm_mine");

      await token.connect(user2).approve(crowdFundContract.address, INIT_BAL);
      await crowdFundContract.connect(user2).pledge(0, INIT_BAL);

      const userBal = await token.balanceOf(user2.address);
      expect(userBal).to.equal(0);
    });
  });
  describe("Unpledge", function () {
    beforeEach(async () => {});

    it("unpledge before compaign started", async function () {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await crowdFundContract.launch(GOAL, startAt, endAt);
      await token.connect(user2).approve(crowdFundContract.address, INIT_BAL);

      await expect(
        crowdFundContract.connect(user2).unpledge(0, INIT_BAL)
      ).to.be.revertedWith("ERC20CrowdFund__CampaignNotStarted");
    });
    it("unpledge when compaign ended", async function () {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await crowdFundContract.launch(GOAL, startAt, endAt);
      await token.connect(user2).approve(crowdFundContract.address, INIT_BAL);

      await ethers.provider.send("evm_increaseTime", [5000]);
      await ethers.provider.send("evm_mine");
      await expect(
        crowdFundContract.connect(user2).unpledge(0, INIT_BAL)
      ).to.be.revertedWith("ERC20CrowdFund__CampaignEnded");
    });
    it("should successfully unpledge", async function () {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await crowdFundContract.launch(GOAL, startAt, endAt);
      await ethers.provider.send("evm_increaseTime", [1000]);
      await ethers.provider.send("evm_mine");

      await token.connect(user2).approve(crowdFundContract.address, INIT_BAL);
      await crowdFundContract.connect(user2).pledge(0, INIT_BAL);

      const campaign = await crowdFundContract.campaigns(0);

      const userBal = await token.balanceOf(user2.address);
      expect(userBal).to.equal(0);

      await crowdFundContract.connect(user2).unpledge(0, INIT_BAL);

      const userBalAfter = await token.balanceOf(user2.address);
      expect(userBalAfter).to.equal(INIT_BAL);
    });
    it("unpledge exceed limit", async function () {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await crowdFundContract.launch(GOAL, startAt, endAt);
      await ethers.provider.send("evm_increaseTime", [1000]);
      await ethers.provider.send("evm_mine");

      await token.connect(user2).approve(crowdFundContract.address, INIT_BAL);
      await crowdFundContract.connect(user2).pledge(0, INIT_BAL);

      const campaign = await crowdFundContract.campaigns(0);

      const userBal = await token.balanceOf(user2.address);
      expect(userBal).to.equal(0);

      await expect(
        crowdFundContract.connect(user2).unpledge(0, EXCEED_BAL)
      ).to.be.revertedWith("ERC20CrowdFund__UnpledgeAmountExceedLimit");
    });
  });
  describe("Claim", function () {
    beforeEach(async () => {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await crowdFundContract.launch(GOAL, startAt, endAt);
    });
    it("claim by owner only", async function () {
      await expect(
        crowdFundContract.connect(user2).claim(0)
      ).to.be.revertedWith("ERC20CrowdFund__OnlyOwnerCanClaim");
    });

    it("claim after goal completed", async function () {
      await expect(
        crowdFundContract.connect(owner).claim(0)
      ).to.be.revertedWith("ERC20CrowdFund__GoalNotComplete");
    });
    it("claim after campaign end", async function () {
      await ethers.provider.send("evm_increaseTime", [1000]);
      await ethers.provider.send("evm_mine");

      await token.connect(user2).approve(crowdFundContract.address, INIT_BAL);
      await crowdFundContract.connect(user2).pledge(0, INIT_BAL);

      await expect(
        crowdFundContract.connect(owner).claim(0)
      ).to.be.revertedWith("ERC20CrowdFund__CampaignNotEnded");
    });

    it("should succesfully claim", async function () {
      const balBefore = await token.balanceOf(owner.address);

      await ethers.provider.send("evm_increaseTime", [1000]);
      await ethers.provider.send("evm_mine");

      await token.connect(user2).approve(crowdFundContract.address, INIT_BAL);
      await crowdFundContract.connect(user2).pledge(0, INIT_BAL);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine");

      await crowdFundContract.connect(owner).claim(0);

      const balAfter = await token.balanceOf(owner.address);
      expect(balBefore.add(INIT_BAL).toString()).equal(balAfter.toString());
    });

    it("should only claimed once", async function () {
      await ethers.provider.send("evm_increaseTime", [1000]);
      await ethers.provider.send("evm_mine");

      await token.connect(user2).approve(crowdFundContract.address, INIT_BAL);
      await crowdFundContract.connect(user2).pledge(0, INIT_BAL);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine");

      await crowdFundContract.connect(owner).claim(0);
      await expect(
        crowdFundContract.connect(owner).claim(0)
      ).to.be.revertedWith("ERC20CrowdFund__CampaignClaimed");
    });
  });
  describe("Cancel", function () {
    beforeEach(async () => {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await crowdFundContract.launch(GOAL, startAt, endAt);
    });
    it("only owner can cancel", async function () {
      await expect(
        crowdFundContract.connect(user2).cancel(0)
      ).to.be.revertedWith("ERC20CrowdFund__OnlyOwnerCanCancel");
    });

    it("cannot cancel after started", async function () {
      await ethers.provider.send("evm_increaseTime", [1000]);
      await ethers.provider.send("evm_mine");
      await expect(
        crowdFundContract.connect(owner).cancel(0)
      ).to.be.revertedWith("ERC20CrowdFund__StartedCannotCancel");
    });
    it("should successfully cancel", async function () {
      await crowdFundContract.connect(owner).cancel(0);
      const c = await crowdFundContract.campaigns(0);

      expect(c.goal.toNumber()).to.equal(0);
      expect(c.startAt).to.equal(0);
      expect(c.endAt).to.equal(0);
    });
  });
  describe("Refund", function () {
    beforeEach(async () => {
      const startAt = await getStartAt();
      const endAt = await getEndAt();
      await crowdFundContract.launch(GOAL, startAt, endAt);
      await ethers.provider.send("evm_increaseTime", [1000]);
      await ethers.provider.send("evm_mine");

      await token.connect(user2).approve(crowdFundContract.address, INIT_BAL);
      await crowdFundContract.connect(user2).pledge(0, INIT_BAL);
    });
    it("only when campaign not ended", async function () {
      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine");
      await expect(
        crowdFundContract.connect(user2).refund(0)
      ).to.be.revertedWith("ERC20CrowdFund__CampaignNotEnded");
    });
    it("should succesfully refund", async function () {
      await crowdFundContract.connect(user2).refund(0);
      const balAfter = await token.balanceOf(user2.address);
      expect(balAfter).equal(INIT_BAL);
    });
  });
});
