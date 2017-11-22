import testHelper from '../helpers/test-helper';
const upgradableContracts = require('../helpers/upgradable-contracts');

const EtherRouter = artifacts.require('EtherRouter');
const Resolver = artifacts.require('Resolver');
const ColonyNetwork = artifacts.require('ColonyNetwork');
const Colony = artifacts.require('Colony');
const Token = artifacts.require('Token');
const Authority = artifacts.require('Authority');

contract('Common Colony', function (accounts) {
  let COLONY_KEY = "Common Colony";
  const MAIN_ACCOUNT = accounts[0];
  const OTHER_ACCOUNT = accounts[1];
  const THIRD_ACCOUNT = accounts[2];
  // This value must be high enough to certify that the failure was not due to the amount of gas but due to a exception being thrown
  const GAS_TO_SPEND = 4700000;
  // The base58 decoded, bytes32 converted value of the task ipfsHash
  const ipfsDecodedHash = '9bb76d8e6c89b524d34a454b3140df28';
  const newIpfsDecodedHash = '9bb76d8e6c89b524d34a454b3140df29';

  const optionsToSpotTransactionFailure = {
    from: MAIN_ACCOUNT,
    gas: GAS_TO_SPEND,
  };

  let commonColony;
  let colonyNetwork;
  let createColonyGas;
  let resolverColonyNetworkDeployed;

  before(async function () {
    resolverColonyNetworkDeployed = await Resolver.deployed();
  });

  beforeEach(async function () {
    let colony = await Colony.new();
    let resolver = await Resolver.new();

    const etherRouter = await EtherRouter.new();
    await etherRouter.setResolver(resolverColonyNetworkDeployed.address);
    colonyNetwork = await ColonyNetwork.at(etherRouter.address);
    await upgradableContracts.setupColonyVersionResolver(colony, resolver, colonyNetwork);

    await colonyNetwork.createColony(COLONY_KEY);
    let commonColonyAddress = await colonyNetwork.getColony.call(COLONY_KEY);
    commonColony = await Colony.at(commonColonyAddress);
  });

  describe('when adding a new skill', () => {
    it('should be able to add a new skill as a child to the root skill', async function () {
      await commonColony.addSkill(0);

      const skillCount = await colonyNetwork.skillCount.call();
      assert.equal(skillCount.toNumber(), 2);

      const newSkill = await colonyNetwork.skills.call(1);
      assert.equal(newSkill[0].toNumber(), 1);
      assert.equal(newSkill[1].toNumber(), 0);

      // Check rootSkill.nChildren is now 1
      const rootSkill = await colonyNetwork.skills.call(0);
      assert.equal(rootSkill[1].toNumber(), 1);

      // Check rootSkill.children first element is the id of the new skill
      const rootSkillChild = await colonyNetwork.getChildSkillId.call(0, 0);
      assert.equal(rootSkillChild.toNumber(), 1);
    });

    it('should NOT be able to add a new skill if called by anyone but the common colony', async function () {
      let tx;
      try {
        tx = await colonyNetwork.addSkill(0);
      } catch (err) {
        tx = testHelper.ifUsingTestRPC(err);
      }
      const skillCount = await colonyNetwork.skillCount.call();
      assert.equal(skillCount.toNumber(), 1);
    });

    it('should be able to add multiple child skills to the root skill', async function () {
      await commonColony.addSkill(0);
      await commonColony.addSkill(0);
      await commonColony.addSkill(0);

      const skillCount = await colonyNetwork.skillCount.call();
      assert.equal(skillCount.toNumber(), 4);

      const newSkill1 = await colonyNetwork.skills.call(1);
      assert.equal(newSkill1[0].toNumber(), 1);
      assert.equal(newSkill1[1].toNumber(), 0);

      const newSkill2 = await colonyNetwork.skills.call(2);
      assert.equal(newSkill2[0].toNumber(), 1);
      assert.equal(newSkill2[1].toNumber(), 0);

      const newSkill3 = await colonyNetwork.skills.call(3);
      assert.equal(newSkill3[0].toNumber(), 1);
      assert.equal(newSkill3[1].toNumber(), 0);

      // Check rootSkill.nChildren is now 3
      const rootSkill = await colonyNetwork.skills.call(0);
      assert.equal(rootSkill[1].toNumber(), 3);

      // Check rootSkill.children contains the ids of the new skills
      const rootSkillChild1 = await colonyNetwork.getChildSkillId.call(0, 0);
      assert.equal(rootSkillChild1.toNumber(), 1);
      const rootSkillChild2 = await colonyNetwork.getChildSkillId.call(0, 1);
      assert.equal(rootSkillChild2.toNumber(), 2);
      const rootSkillChild3 = await colonyNetwork.getChildSkillId.call(0, 2);
      assert.equal(rootSkillChild3.toNumber(), 3);
    });

    it('should be able to add child skills a few levels down the skills tree', async function () {
      // Add 2 skill nodes to root skill
      await commonColony.addSkill(0);
      await commonColony.addSkill(0);
      // Add a child skill to skill id 2
      await commonColony.addSkill(2);

      const newDeepSkill = await colonyNetwork.skills.call(3);
      assert.equal(newDeepSkill[0].toNumber(), 2);
      assert.equal(newDeepSkill[1].toNumber(), 0);

      const parentSkill1 = await colonyNetwork.getParentSkillId.call(3, 0);
      assert.equal(parentSkill1.toNumber(), 2);

      const parentSkill2 = await colonyNetwork.getParentSkillId.call(3, 1);
      assert.equal(parentSkill2.toNumber(), 0);
    });

    it('should NOT be able to add a child skill for a non existent parent', async function () {
      // Add 2 skill nodes to root skill
      await commonColony.addSkill(0);
      await commonColony.addSkill(0);

      let tx;
      try {
        tx = await commonColony.addSkill(3);
      } catch (err) {
        tx = testHelper.ifUsingTestRPC(err);
      }

      const skillCount = await colonyNetwork.skillCount.call();
      assert.equal(skillCount.toNumber(), 3);
    });

    it('should be able to add skills in the middle of the skills tree', async function () {
      await commonColony.addSkill(0);
      await commonColony.addSkill(0);
      await commonColony.addSkill(2);
      await commonColony.addSkill(0);
      await commonColony.addSkill(1);
      await commonColony.addSkill(2);

      const rootSkill = await colonyNetwork.skills.call(0);
      assert.equal(rootSkill[0].toNumber(), 0);
      assert.equal(rootSkill[1].toNumber(), 6);
      const rootSkillChildSkillId1 = await colonyNetwork.getChildSkillId.call(0, 0);
      assert.equal(rootSkillChildSkillId1.toNumber(), 1);
      const rootSkillChildSkillId2 = await colonyNetwork.getChildSkillId.call(0, 1);
      assert.equal(rootSkillChildSkillId2.toNumber(), 2);
      const rootSkillChildSkillId3 = await colonyNetwork.getChildSkillId.call(0, 2);
      assert.equal(rootSkillChildSkillId3.toNumber(), 3);
      const rootSkillChildSkillId4 = await colonyNetwork.getChildSkillId.call(0, 3);
      assert.equal(rootSkillChildSkillId4.toNumber(), 4);
      const rootSkillChildSkillId5 = await colonyNetwork.getChildSkillId.call(0, 4);
      assert.equal(rootSkillChildSkillId5.toNumber(), 5);
      const rootSkillChildSkillId6 = await colonyNetwork.getChildSkillId.call(0, 5);
      assert.equal(rootSkillChildSkillId6.toNumber(), 6);

      const skill1 = await colonyNetwork.skills.call(1);
      assert.equal(skill1[0].toNumber(), 1);
      assert.equal(skill1[1].toNumber(), 1);
      const skill1ParentSkillId1 = await colonyNetwork.getParentSkillId.call(1, 0);
      assert.equal(skill1ParentSkillId1.toNumber(), 0);
      const skill1ChildSkillId1 = await colonyNetwork.getChildSkillId.call(1, 0);
      assert.equal(skill1ChildSkillId1.toNumber(), 5);

      const skill2 = await colonyNetwork.skills.call(2);
      assert.equal(skill2[0].toNumber(), 1);
      assert.equal(skill2[1].toNumber(), 2);
      const skill2ParentSkillId1 = await colonyNetwork.getParentSkillId.call(2, 0);
      assert.equal(skill2ParentSkillId1.toNumber(), 0);
      const skill2ChildSkillId1 = await colonyNetwork.getChildSkillId.call(2, 0);
      assert.equal(skill2ChildSkillId1.toNumber(), 3);
      const skill2ChildSkillId2 = await colonyNetwork.getChildSkillId.call(2, 1);
      assert.equal(skill2ChildSkillId2.toNumber(), 6);

      const skill3 = await colonyNetwork.skills.call(3);
      assert.equal(skill3[0].toNumber(), 2);
      assert.equal(skill3[1].toNumber(), 0);
      const skill3ParentSkillId1 = await colonyNetwork.getParentSkillId.call(3, 0);
      assert.equal(skill3ParentSkillId1.toNumber(), 2);
      const skill3ParentSkillId2 = await colonyNetwork.getParentSkillId.call(3, 1);
      assert.equal(skill3ParentSkillId2.toNumber(), 0);

      const skill4 = await colonyNetwork.skills.call(4);
      assert.equal(skill4[0].toNumber(), 1);
      assert.equal(skill4[1].toNumber(), 0);
      const skill4ParentSkillId1 = await colonyNetwork.getParentSkillId.call(4, 0);
      assert.equal(skill4ParentSkillId1.toNumber(), 0);

      const skill5 = await colonyNetwork.skills.call(5);
      assert.equal(skill5[0].toNumber(), 2);
      assert.equal(skill5[1].toNumber(), 0);
      const skill5ParentSkillId1 = await colonyNetwork.getParentSkillId.call(5, 0);
      assert.equal(skill5ParentSkillId1.toNumber(), 1);
      const skill5ParentSkillId2 = await colonyNetwork.getParentSkillId.call(5, 1);
      assert.equal(skill5ParentSkillId2.toNumber(), 0);

      const skill6 = await colonyNetwork.skills.call(6);
      assert.equal(skill6[0].toNumber(), 2);
      assert.equal(skill6[1].toNumber(), 0);
      const skill6ParentSkillId1 = await colonyNetwork.getParentSkillId.call(6, 0);
      assert.equal(skill6ParentSkillId1.toNumber(), 2);
      const skill6ParentSkillId2 = await colonyNetwork.getParentSkillId.call(6, 1);
      assert.equal(skill6ParentSkillId2.toNumber(), 0);
    });

    it('when N parents are there, should record parent skill ids for N = integer powers of 2', async function () {
      await commonColony.addSkill(0);
      await commonColony.addSkill(1);
      await commonColony.addSkill(2);
      await commonColony.addSkill(3);
      await commonColony.addSkill(4);
      await commonColony.addSkill(5);
      await commonColony.addSkill(6);
      await commonColony.addSkill(7);
      await commonColony.addSkill(8);


      const skill9 = await colonyNetwork.skills.call(9);
      assert.equal(skill9[0].toNumber(), 9);
      assert.equal(skill9[1].toNumber(), 0);

      const skill9ParentSkillId1 = await colonyNetwork.getParentSkillId.call(9, 0);
      assert.equal(skill9ParentSkillId1.toNumber(), 8);
      const skill9ParentSkillId2 = await colonyNetwork.getParentSkillId.call(9, 1);
      assert.equal(skill9ParentSkillId2.toNumber(), 7);
      const skill9ParentSkillId3 = await colonyNetwork.getParentSkillId.call(9, 2);
      assert.equal(skill9ParentSkillId3.toNumber(), 5);
      const skill9ParentSkillId4 = await colonyNetwork.getParentSkillId.call(9, 3);
      assert.equal(skill9ParentSkillId4.toNumber(), 1);
    });
  });
});