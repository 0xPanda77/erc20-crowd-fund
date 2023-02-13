// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

error ERC20CrowdFund__StartAtShouldLessThanEndAt();
error ERC20CrowdFund__StartAtShouldGreaterThanNow();
error ERC20CrowdFund__EndAtExceedMaxPeriod();
error ERC20CrowdFund__StartedCannotCancel();
error ERC20CrowdFund__OnlyOwnerCanCancel();
error ERC20CrowdFund__CampaignEnded();
error ERC20CrowdFund__CampaignNotEnded();
error ERC20CrowdFund__CampaignNotStarted();
error ERC20CrowdFund__OnlyOwnerCanClaim();
error ERC20CrowdFund__GoalNotComplete();
error ERC20CrowdFund__CampaignClaimed();
error ERC20CrowdFund__UnpledgeAmountExceedLimit();

contract ERC20CrowdFund {
  using SafeERC20 for IERC20;

  IERC20 public immutable token;
  uint public id;
  struct Campaign {
    address owner;
    uint goal;
    uint pledged;
    uint32 startAt;
    uint32 endAt;
    bool claimed;
  }
  mapping(uint => Campaign) public campaigns;
  mapping(uint => mapping(address => uint)) public campaignUserPledgedAmount;
  uint private constant MAX_PERIOD = 7 days;

  event Cancel(uint id);
  event Launch(
    uint indexed id,
    address indexed owner,
    uint goal,
    uint32 startAt,
    uint32 endAt
  );
  event Pledge(uint indexed id, address user, uint amount);
  event Unpledge(uint indexed id, address user, uint amount);
  event Claim(uint indexed id);
  event Refund(uint indexed id, address user, uint refundBal);

  constructor(address _token) {
    token = IERC20(_token);
  }

  function launch(uint _goal, uint32 _startAt, uint32 _endAt) external {
    if (_startAt > _endAt) revert ERC20CrowdFund__StartAtShouldLessThanEndAt();
    if (_startAt <= block.timestamp)
      revert ERC20CrowdFund__StartAtShouldGreaterThanNow();
    if (_endAt >= _startAt + MAX_PERIOD)
      revert ERC20CrowdFund__EndAtExceedMaxPeriod();

    campaigns[id] = Campaign({
      owner: msg.sender,
      goal: _goal,
      pledged: 0,
      startAt: _startAt,
      endAt: _endAt,
      claimed: false
    });

    emit Launch(id, msg.sender, _goal, _startAt, _endAt);
    id += 1;
  }

  function cancel(uint _id) external {
    Campaign memory _c = campaigns[_id];
    if (_c.owner != msg.sender) revert ERC20CrowdFund__OnlyOwnerCanCancel();
    if (_c.startAt < block.timestamp)
      revert ERC20CrowdFund__StartedCannotCancel();

    delete campaigns[_id];
    emit Cancel(_id);
  }

  function pledge(uint _id, uint _amount) external {
    Campaign storage _c = campaigns[_id];
    if (_c.startAt > block.timestamp)
      revert ERC20CrowdFund__CampaignNotStarted();
    if (_c.endAt < block.timestamp) revert ERC20CrowdFund__CampaignEnded();
    // _c.pledged += _amount;
    _c.pledged = _c.pledged + _amount;
    campaignUserPledgedAmount[_id][msg.sender] += _amount;

    token.safeTransferFrom(msg.sender, address(this), _amount);
    emit Pledge(_id, msg.sender, _amount);
  }

  function unpledge(uint _id, uint _amount) external {
    Campaign storage _c = campaigns[_id];
    if (_c.startAt > block.timestamp)
      revert ERC20CrowdFund__CampaignNotStarted();
    if (_c.endAt < block.timestamp) revert ERC20CrowdFund__CampaignEnded();
    if (campaignUserPledgedAmount[_id][msg.sender] < _amount)
      revert ERC20CrowdFund__UnpledgeAmountExceedLimit();
    _c.pledged -= _amount;
    campaignUserPledgedAmount[_id][msg.sender] -= _amount;

    token.safeTransfer(msg.sender, _amount);

    emit Unpledge(_id, msg.sender, _amount);
  }

  function claim(uint _id) external {
    Campaign storage _c = campaigns[_id];
    if (_c.owner != msg.sender) revert ERC20CrowdFund__OnlyOwnerCanClaim();
    if (_c.pledged < _c.goal) revert ERC20CrowdFund__GoalNotComplete();
    if (_c.endAt > block.timestamp) revert ERC20CrowdFund__CampaignNotEnded();
    if (_c.claimed) revert ERC20CrowdFund__CampaignClaimed();

    token.safeTransfer(msg.sender, _c.pledged);

    _c.claimed = true;
    emit Claim(_id);
  }

  function refund(uint _id) external {
    Campaign memory _c = campaigns[_id];
    if (_c.endAt < block.timestamp) revert ERC20CrowdFund__CampaignNotEnded();

    uint refundBal = campaignUserPledgedAmount[_id][msg.sender];
    campaignUserPledgedAmount[_id][msg.sender] = 0;
    token.safeTransfer(msg.sender, refundBal);

    emit Refund(_id, msg.sender, refundBal);
  }
}
