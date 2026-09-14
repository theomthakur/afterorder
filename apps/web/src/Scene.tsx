import { Canvas } from '@react-three/fiber';
import { Environment, Float, OrbitControls, RoundedBox, Text } from '@react-three/drei';
import type { AgentId, AgentState, OrderSnapshot } from '../../../packages/shared/src/types.ts';

const positions: Record<AgentId, [number, number, number]> = {
  manager: [0, 0.45, 0], sourcing: [-3.1, 0.3, -1.9], policy: [-3.1, 0.3, 1.9],
  logistics: [3.1, 0.3, -1.9], purchasing: [3.1, 0.3, 1.9], reconciliation: [0, 0.3, 3.4]
};
const colors = { idle: '#777481', working: '#8b5cf6', waiting: '#d19a37', retrying: '#ef6d58', blocked: '#dc4655', complete: '#28a89b' };

function Station({ agent, selected, onSelect }: { agent: AgentState; selected: boolean; onSelect: () => void }) {
  const p = positions[agent.id];
  return <group position={p} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
    <Float speed={agent.status === 'working' ? 3 : 1} floatIntensity={agent.status === 'working' ? .22 : .05}>
      <RoundedBox args={[agent.id === 'manager' ? 2.3 : 2.1, .52, 1.25]} radius={.15} smoothness={4} castShadow>
        <meshStandardMaterial color={selected ? '#eee7ff' : '#ddd8cd'} roughness={.65}/>
      </RoundedBox>
      <mesh position={[0, .73, 0]} castShadow><sphereGeometry args={[.29, 24, 24]}/><meshStandardMaterial color={colors[agent.status]}/></mesh>
      <Text position={[0, 1.23, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.27} color="#292632" anchorX="center">{agent.name}</Text>
      <Text position={[0, .91, .28]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.16} color={colors[agent.status]} anchorX="center">{agent.status.toUpperCase()}</Text>
    </Float>
  </group>;
}

function Vault({ snapshot }: { snapshot: OrderSnapshot }) {
  return <group position={[4.5, .1, 1.9]}>
    <RoundedBox args={[1.45, 1.6, 1.25]} radius={.1} smoothness={3}><meshStandardMaterial color="#292632" metalness={.2}/></RoundedBox>
    <Text position={[0, 1.08, .66]} fontSize={.2} color="#f7f3e9">PAYMENT VAULT</Text>
    <Text position={[0, .76, .66]} fontSize={.19} color="#74d9c8">{snapshot.vault.locked ? `${snapshot.vault.locked} LOCKED` : snapshot.vault.paid ? `${snapshot.vault.paid} PAID` : `${snapshot.vault.available} READY`}</Text>
  </group>;
}

export function Scene({ snapshot, selected, onSelect }: { snapshot: OrderSnapshot | null; selected: AgentId; onSelect: (id: AgentId) => void }) {
  return <Canvas shadows camera={{ position: [8, 10, 11], fov: 37 }} dpr={[1, 1.6]}>
    <color attach="background" args={['#ece8de']}/><ambientLight intensity={1.1}/><directionalLight position={[5, 10, 5]} intensity={1.7} castShadow/>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, .8]} receiveShadow><planeGeometry args={[13, 11]}/><meshStandardMaterial color="#e1ddd2"/></mesh>
    {(snapshot?.agents ?? []).map((agent) => <Station key={agent.id} agent={agent} selected={agent.id === selected} onSelect={() => onSelect(agent.id)}/>) }
    {snapshot && <><Vault snapshot={snapshot}/><Text position={[-4.8, .15, -3.5]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.27} color="#4e4a56">SHOPIFY INBOUND</Text><Text position={[4.2, .15, -3.5]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.27} color="#4e4a56">SUPPLIER DOCKS</Text></>}
    <OrbitControls makeDefault enablePan={false} minDistance={8} maxDistance={18} minPolarAngle={.65} maxPolarAngle={1.15}/><Environment preset="warehouse"/>
  </Canvas>;
}
