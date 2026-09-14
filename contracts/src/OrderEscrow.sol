// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20AO { function transfer(address,uint256) external returns(bool); function transferFrom(address,address,uint256) external returns(bool); }
interface IRegistryAO { function authority(bytes32) external view returns(address,address,address,bytes32); function consume(bytes32,address,uint128) external; }

contract OrderEscrow {
    enum State { None, Funded, Accepted, Released, Refunded }
    struct Order { address merchant; address supplier; address token; uint128 amount; uint64 acceptBy; uint64 dispatchBy; address evidenceSigner; bytes32 intentHash; State state; }
    IRegistryAO public immutable registry;
    mapping(address => mapping(address => uint256)) public available;
    mapping(bytes32 => Order) public orders;
    mapping(bytes32 => bool) public usedEvidence;
    uint256 private lockState = 1;
    event Deposit(address indexed merchant,address indexed token,uint256 amount);
    event OrderFunded(bytes32 indexed id,bytes32 indexed mandateId,address indexed supplier,address token,uint256 amount,bytes32 intentHash);
    event OrderAccepted(bytes32 indexed id,address indexed supplier);
    event OrderReleased(bytes32 indexed id,address indexed supplier,uint256 amount,bytes32 evidenceDigest);
    event OrderRefunded(bytes32 indexed id,address indexed merchant,uint256 amount);
    modifier nonReentrant(){require(lockState==1,"reentrant");lockState=2;_;lockState=1;}
    constructor(address registryAddress){registry=IRegistryAO(registryAddress);}
    function deposit(address token,uint256 amount) external nonReentrant { require(amount>0,"amount"); require(IERC20AO(token).transferFrom(msg.sender,address(this),amount),"transfer"); available[msg.sender][token]+=amount; emit Deposit(msg.sender,token,amount); }
    function fundOrder(bytes32 id,bytes32 mandateId,address supplier,address token,uint128 amount,uint64 acceptBy,uint64 dispatchBy,address evidenceSigner,bytes32 intentHash,bytes32[] calldata supplierProof) external nonReentrant {
        (address owner,address delegate,address mandateToken,bytes32 supplierRoot)=registry.authority(mandateId);
        require(msg.sender==delegate && owner!=address(0) && token==mandateToken,"delegate");
        require(_verifySupplier(supplierRoot,supplier,supplierProof),"supplier");
        require(orders[id].state==State.None && supplier!=address(0) && evidenceSigner!=address(0) && acceptBy>block.timestamp && dispatchBy>acceptBy,"order"); require(available[owner][token]>=amount,"funds");
        registry.consume(mandateId,token,amount); available[owner][token]-=amount; orders[id]=Order(owner,supplier,token,amount,acceptBy,dispatchBy,evidenceSigner,intentHash,State.Funded); emit OrderFunded(id,mandateId,supplier,token,amount,intentHash);
    }
    function acceptOrder(bytes32 id) external { Order storage o=orders[id];require(o.state==State.Funded && msg.sender==o.supplier && block.timestamp<o.acceptBy,"accept");o.state=State.Accepted;emit OrderAccepted(id,msg.sender); }
    function refundExpired(bytes32 id) external { Order storage o=orders[id];require((o.state==State.Funded && block.timestamp>=o.acceptBy)||(o.state==State.Accepted && block.timestamp>=o.dispatchBy),"refund");o.state=State.Refunded;available[o.merchant][o.token]+=o.amount;emit OrderRefunded(id,o.merchant,o.amount); }
    function releaseOnDispatch(bytes32 id,bytes32 evidenceDigest,bytes calldata signature) external nonReentrant {
        Order storage o=orders[id];require(o.state==State.Accepted && !usedEvidence[evidenceDigest],"release");bytes32 message=keccak256(abi.encodePacked("AFTERORDER_DISPATCH",block.chainid,address(this),id,o.intentHash,evidenceDigest));address signer=_recover(_ethHash(message),signature);require(signer==o.evidenceSigner,"evidence");usedEvidence[evidenceDigest]=true;o.state=State.Released;require(IERC20AO(o.token).transfer(o.supplier,o.amount),"transfer");emit OrderReleased(id,o.supplier,o.amount,evidenceDigest);
    }
    function _ethHash(bytes32 h) internal pure returns(bytes32){return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",h));}
    function _verifySupplier(bytes32 root,address supplier,bytes32[] calldata proof) internal pure returns(bool){bytes32 h=keccak256(abi.encodePacked(supplier));for(uint256 i;i<proof.length;i++){bytes32 p=proof[i];h=h<p?keccak256(abi.encodePacked(h,p)):keccak256(abi.encodePacked(p,h));}return h==root;}
    function _recover(bytes32 h,bytes calldata sig) internal pure returns(address){require(sig.length==65,"signature");bytes32 r;bytes32 s;uint8 v;assembly{r:=calldataload(sig.offset)s:=calldataload(add(sig.offset,32))v:=byte(0,calldataload(add(sig.offset,64)))}if(v<27)v+=27;require(v==27||v==28,"v");return ecrecover(h,v,r,s);}
}
