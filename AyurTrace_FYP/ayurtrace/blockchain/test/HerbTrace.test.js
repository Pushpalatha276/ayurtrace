const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HerbTrace", function () {
  let herbTrace;
  let owner, collector, aggregator, processor, manufacturer, consumer;

  beforeEach(async function () {
    [owner, collector, aggregator, processor, manufacturer, consumer] =
      await ethers.getSigners();

    const HerbTrace = await ethers.getContractFactory("HerbTrace");
    herbTrace = await HerbTrace.deploy();
    await herbTrace.waitForDeployment();

    await herbTrace.assignRole(collector.address, 1, "Ramu Collector");
    await herbTrace.assignRole(aggregator.address, 2, "Mandi Aggregator");
    await herbTrace.assignRole(processor.address, 3, "Herbal Processor");
    await herbTrace.assignRole(manufacturer.address, 4, "AyurCo Manufacturer");
  });

  describe("Role Management", function () {
    it("Should assign roles correctly", async function () {
      expect(await herbTrace.roles(collector.address)).to.equal(1);
      expect(await herbTrace.roles(aggregator.address)).to.equal(2);
      expect(await herbTrace.roles(processor.address)).to.equal(3);
      expect(await herbTrace.roles(manufacturer.address)).to.equal(4);
    });

    it("Should allow self-registration", async function () {
      await herbTrace.connect(consumer).selfRegister(1, "Self Collector");
      expect(await herbTrace.roles(consumer.address)).to.equal(1);
    });

    it("Should prevent double registration", async function () {
      await herbTrace.connect(consumer).selfRegister(1, "Self Collector");
      await expect(
        herbTrace.connect(consumer).selfRegister(2, "Self Aggregator")
      ).to.be.revertedWith("Already registered");
    });
  });

  describe("Batch Creation", function () {
    it("Should create a batch as collector", async function () {
      const tx = await herbTrace.connect(collector).createBatch(
        "BATCH001", "Ashwagandha", "Withania somnifera",
        5000, 12971598, 77594566,
        "Mysuru Forest, Karnataka", "Fresh roots collected at dawn", "QmExampleIPFSHash123"
      );

      await expect(tx)
        .to.emit(herbTrace, "BatchCreated")
        .withArgs("BATCH001", "Ashwagandha", collector.address, await getTimestamp(tx));

      const batch = await herbTrace.getBatch("BATCH001");
      expect(batch.herbName).to.equal("Ashwagandha");
      expect(batch.quantityGrams).to.equal(5000);
      expect(batch.status).to.equal(0);
    });

    it("Should reject duplicate batch IDs", async function () {
      await herbTrace.connect(collector).createBatch(
        "BATCH001", "Ashwagandha", "Withania somnifera",
        5000, 12971598, 77594566, "Mysuru", "Notes", "QmHash"
      );
      await expect(
        herbTrace.connect(collector).createBatch(
          "BATCH001", "Tulsi", "Ocimum tenuiflorum",
          2000, 12971598, 77594566, "Mysuru", "Notes2", "QmHash2"
        )
      ).to.be.revertedWith("Batch ID already exists");
    });

    it("Should reject non-collectors creating batches", async function () {
      await expect(
        herbTrace.connect(aggregator).createBatch(
          "BATCH002", "Tulsi", "Ocimum tenuiflorum",
          2000, 12971598, 77594566, "Mysuru", "Notes", "QmHash"
        )
      ).to.be.reverted;
    });
  });

  describe("Supply Chain Events", function () {
    beforeEach(async function () {
      await herbTrace.connect(collector).createBatch(
        "BATCH001", "Ashwagandha", "Withania somnifera",
        5000, 12971598, 77594566, "Mysuru Forest", "Fresh roots", "QmHash1"
      );
    });

    it("Should log aggregator event", async function () {
      await expect(
        herbTrace.connect(aggregator).logEvent(
          "BATCH001", 1, 12975000, 77600000,
          "Mysuru Mandi", "Batch weighed, grade A quality", "QmHash2"
        )
      ).to.emit(herbTrace, "EventLogged");

      const count = await herbTrace.getEventCount("BATCH001");
      expect(count).to.equal(2);
    });

    it("Should log processor event", async function () {
      await herbTrace.connect(aggregator).logEvent("BATCH001", 1, 0, 0, "Mandi", "Notes", "");
      await herbTrace.connect(processor).logEvent("BATCH001", 2, 0, 0, "Factory", "Cleaned and dried", "QmHash3");
      const count = await herbTrace.getEventCount("BATCH001");
      expect(count).to.equal(3);
    });

    it("Should complete batch after manufacturer event", async function () {
      await herbTrace.connect(aggregator).logEvent("BATCH001", 1, 0, 0, "Mandi", "Graded", "");
      await herbTrace.connect(processor).logEvent("BATCH001", 2, 0, 0, "Factory", "Processed", "");
      await herbTrace.connect(manufacturer).logEvent("BATCH001", 3, 0, 0, "Plant", "Ashwagandha capsules batch #A001", "QmHash4");
      const batch = await herbTrace.getBatch("BATCH001");
      expect(batch.status).to.equal(1);
    });

    it("Should retrieve event details correctly", async function () {
     
const result = await herbTrace.getTraceEvent("BATCH001", 0);
      expect(Number(result[0])).to.equal(0);
      expect(result[2]).to.equal("Ramu Collector");
      expect(result[5]).to.equal("Mysuru Forest");
      expect(result[6]).to.equal("Fresh roots");
    });

    it("Should reject wrong role for node type", async function () {
      await expect(
        herbTrace.connect(collector).logEvent("BATCH001", 1, 0, 0, "Mandi", "Notes", "")
      ).to.be.revertedWith("Wrong role for this node");
    });
  });

  describe("Public Verification (QR Scan)", function () {
    beforeEach(async function () {
      await herbTrace.connect(collector).createBatch(
        "BATCH001", "Tulsi", "Ocimum tenuiflorum",
        3000, 12971598, 77594566, "Bengaluru Farm", "Organic", "QmHash1"
      );
    });

    it("Should allow anyone to verify a batch", async function () {
      const batch = await herbTrace.connect(consumer).getBatch("BATCH001");
      expect(batch.herbName).to.equal("Tulsi");
    });

    it("Should track stats correctly", async function () {
      const [totalBatches, totalEvents] = await herbTrace.getStats();
      expect(totalBatches).to.equal(1);
      expect(totalEvents).to.equal(1);
    });

    it("Should return all batch IDs", async function () {
      const ids = await herbTrace.getAllBatchIds();
      expect(ids).to.include("BATCH001");
    });
  });
});

async function getTimestamp(tx) {
  const receipt = await tx.wait();
  const block = await ethers.provider.getBlock(receipt.blockNumber);
  return block.timestamp;
}