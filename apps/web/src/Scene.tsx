import { Component, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, Line, OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { AgentId, AgentState, OrderSnapshot } from '../../../packages/shared/src/types.ts';

type V3 = [number, number, number];

const positions: Record<AgentId, V3> = {
  manager: [0, 0, 0], sourcing: [-4.15, 0, -3.15], policy: [-4.1, 0, 3.25],
  logistics: [4.1, 0, -3.15], purchasing: [4.1, 0, 3.25], reconciliation: [0, 0, 4.25],
};

const departments: Record<AgentId, { color: string; pale: string; label: string }> = {
  manager: { color: '#836ef9', pale: '#f1edff', label: 'Command' },
  sourcing: { color: '#16a394', pale: '#e6f5f2', label: 'Sourcing' },
  policy: { color: '#d99b28', pale: '#fff4dc', label: 'Policy' },
  logistics: { color: '#4f7cac', pale: '#eaf0f6', label: 'Logistics' },
  purchasing: { color: '#df5a57', pale: '#fdebea', label: 'Purchasing' },
  reconciliation: { color: '#657585', pale: '#edf0f3', label: 'Reconciliation' },
};

const statusCopy: Record<AgentState['status'], string> = {
  idle: 'Ready', working: 'Working', waiting: 'Monitoring', retrying: 'Replanning', blocked: 'Needs review', complete: 'Complete',
};

function Box({ position, size, color, radius = 0.04 }: { position: V3; size: V3; color: string; radius?: number }) {
  return <RoundedBox args={size} position={position} radius={radius} smoothness={3} castShadow receiveShadow><meshStandardMaterial color={color} roughness={0.82}/></RoundedBox>;
}

function Crate({ position, scale = 1 }: { position: V3; scale?: number }) {
  return <group position={position} scale={scale}>
    <Box position={[0, .25, 0]} size={[.6, .5, .58]} color="#6d6582"/>
    <Box position={[0, .5, 0]} size={[.62, .025, .6]} color="#ffb84d"/>
    <Box position={[0, .26, .302]} size={[.09, .48, .018]} color="#ffb84d"/>
    <Box position={[.16, .31, .315]} size={[.2, .15, .012]} color="#fbfaff"/>
  </group>;
}

function Rack({ position, rotationY = 0 }: { position: V3; rotationY?: number }) {
  return <group position={position} rotation={[0, rotationY, 0]}>
    {[-.62, .62].map((x) => [-.3, .3].map((z) => <Box key={`${x}-${z}`} position={[x, .85, z]} size={[.055, 1.7, .055]} color="#44395f"/>))}
    {[.15, .75, 1.35].map((y, row) => <group key={y}>
      <Box position={[0, y, 0]} size={[1.35, .08, .72]} color="#746b8d"/>
      <Crate position={[-.32, y + .06, 0]} scale={row === 1 ? .7 : .58}/><Crate position={[.3, y + .06, 0]} scale={.55}/>
    </group>)}
  </group>;
}

function FloorSign({ text, position, width = 2.3 }: { text: string; position: V3; width?: number }) {
  return <Html center position={position} rotation={[-Math.PI / 2, 0, 0]} transform distanceFactor={10} zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}><span className="floor-sign" style={{ width: `${width * 38}px` }}>{text}</span></Html>;
}

function Warehouse() {
  return <group>
    <Box position={[0, -.2, .35]} size={[15.8, .4, 11.8]} color="#1b1e23" radius={.02}/>
    <Box position={[0, .015, .35]} size={[15.25, .07, 11.25]} color="#e7e3dc" radius={.03}/>
    {Array.from({ length: 15 }, (_, index) => <Box key={index} position={[-7 + index, .057, .35]} size={[.012, .014, 11.05]} color={index % 2 ? '#d8d4cd' : '#f7f4ef'} radius={.001}/>) }
    <Box position={[6.25, .075, -.05]} size={[2.1, .035, 10.25]} color="#6f777d" radius={.02}/>
    <Line points={[[5.2, .1, -5], [5.2, .1, 5]]} color="#f6c453" lineWidth={2}/>
    {Array.from({ length: 16 }, (_, index) => <Box key={index} position={[6.2, .1, -4.7 + index * .62]} size={[.55, .018, .09]} color={index % 2 ? '#f6c453' : '#34383f'} radius={.002}/>) }
    <Rack position={[-6.6, .08, -1.2]}/><Rack position={[6.65, .08, -2.2]} rotationY={Math.PI}/>
    <Crate position={[6.2, .1, 3.75]} scale={1.25}/><Crate position={[6.95, .1, 3.9]}/><Crate position={[-6.4, .1, 3.9]} scale={1.15}/>
    <FloorSign text="SHOPIFY INBOUND" position={[-5.9, .105, 4.85]}/><FloorSign text="SUPPLIER DOCKS" position={[6.15, .105, -4.7]}/>
  </group>;
}

function Plant({ position }: { position: V3 }) {
  return <group position={position}>
    <mesh position={[0, .14, 0]} castShadow><cylinderGeometry args={[.14, .1, .28, 12]}/><meshStandardMaterial color="#f0a45e"/></mesh>
    <mesh position={[0, .4, 0]} castShadow><sphereGeometry args={[.21, 14, 14]}/><meshStandardMaterial color="#178d79"/></mesh>
    <mesh position={[.1, .56, .02]} castShadow><sphereGeometry args={[.15, 14, 14]}/><meshStandardMaterial color="#42c5aa"/></mesh>
  </group>;
}

function Avatar({ color, active }: { color: string; active: boolean }) {
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (body.current) body.current.position.y = active ? Math.sin(clock.elapsedTime * 3) * .018 : 0; });
  return <group position={[0, .04, .64]}>
    <Box position={[0, .35, .05]} size={[.42, .1, .4]} color="#625a77"/><Box position={[0, .57, .22]} size={[.4, .42, .08]} color="#766d8c"/>
    <group ref={body}>
      <Box position={[-.1, .3, -.08]} size={[.12, .3, .14]} color="#2b2148"/><Box position={[.1, .3, -.08]} size={[.12, .3, .14]} color="#2b2148"/>
      <Box position={[0, .62, 0]} size={[.38, .44, .26]} color={color} radius={.08}/>
      <mesh position={[0, .98, 0]} castShadow><sphereGeometry args={[.2, 18, 18]}/><meshStandardMaterial color="#d8ad8a"/></mesh>
      <mesh position={[0, 1.06, .015]} castShadow><sphereGeometry args={[.196, 18, 14, 0, Math.PI * 2, 0, Math.PI * .56]}/><meshStandardMaterial color="#241b3f"/></mesh>
      <Box position={[-.23, .67, -.14]} size={[.12, .12, .35]} color={color}/><Box position={[.23, .67, -.14]} size={[.12, .12, .35]} color={color}/>
    </group>
  </group>;
}

function Monitor({ x, color, active }: { x: number; color: string; active: boolean }) {
  return <group position={[x, 0, 0]}>
    <Box position={[0, .92, -.12]} size={[.34, .035, .22]} color="#625a77"/><Box position={[0, 1.08, -.15]} size={[.05, .3, .05]} color="#625a77"/>
    <Box position={[0, 1.24, -.16]} size={[.7, .44, .06]} color="#241b3f"/><Box position={[0, 1.24, -.125]} size={[.62, .35, .012]} color="#f1effb" radius={.004}/>
    {[0, 1, 2].map((row) => <Box key={row} position={[-.06, 1.33 - row * .085, -.115]} size={[row === 2 ? .2 : .38, .025, .006]} color={row === 0 ? color : '#bdb5cf'} radius={.002}/>) }
    <mesh position={[.25, 1.08, -.09]}><sphereGeometry args={[.015, 8, 8]}/><meshBasicMaterial color={active ? '#25bfa5' : '#aaa2b8'}/></mesh>
  </group>;
}

function Desk({ color, central, active }: { color: string; central: boolean; active: boolean }) {
  const width = central ? 2.05 : 1.68;
  return <group>
    <Box position={[0, .84, 0]} size={[width, .11, .78]} color="#aaa2bd"/>
    {[-width / 2 + .17, width / 2 - .17].map((x) => <Box key={x} position={[x, .42, .02]} size={[.08, .76, .55]} color="#f7f4fb"/>) }
    {central ? (
      <><Monitor x={-.38} color={color} active={active}/><Monitor x={.4} color={color} active={active}/></>
    ) : <Monitor x={0} color={color} active={active}/>}
    <Box position={[0, .93, .25]} size={[.46, .03, .16]} color="#e4e0ee"/><mesh position={[-width / 2 + .2, 1, .2]} castShadow><cylinderGeometry args={[.07, .06, .15, 12]}/><meshStandardMaterial color="#fbfaff"/></mesh>
    <Avatar color={color} active={active}/>
  </group>;
}

function Station({ agent, selected, onSelect }: { agent: AgentState; selected: boolean; onSelect: () => void }) {
  const central = agent.id === 'manager'; const department = departments[agent.id]; const size = central ? 3.35 : 2.65; const active = ['working', 'retrying'].includes(agent.status);
  return <group position={positions[agent.id]}>
    <group onClick={(event) => { event.stopPropagation(); onSelect(); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
      <Box position={[0, .035, 0]} size={[size, .05, size]} color={selected ? '#836ef9' : '#8a86a0'} radius={.1}/><Box position={[0, .066, 0]} size={[size - .1, .012, size - .1]} color={central ? '#e6e0ff' : '#ece9f5'} radius={.08}/>
      <Line points={[[ -size/2 + .13, .078, size/2 - .13 ], [ size/2 - .13, .078, size/2 - .13 ], [ size/2 - .13, .078, -size/2 + .13 ], [ -size/2 + .13, .078, -size/2 + .13 ], [ -size/2 + .13, .078, size/2 - .13 ]]} color={selected ? department.color : '#fbfaff'} lineWidth={selected ? 2 : 1}/>
      <group position={[0, .065, .08]}><Desk color={department.color} central={central} active={active}/></group><Plant position={[-size / 2 + .35, .08, -size / 2 + .36]}/>
      <Box position={[size / 2 - .31, .29, -size / 2 + .38]} size={[.38, .42, .43]} color="#f0edf7"/>
      {[0, 1, 2].map((row) => <Box key={row} position={[size / 2 - .31, .52 + row * .05, -size / 2 + .38]} size={[.31, .045, .34]} color={[department.color, '#b5acc7', '#fbfaff'][row]!}/>) }
    </group>
    <Html center position={[0, central ? 2.38 : 2.18, .04]} zIndexRange={[80, 40]}>
      <button className={`station-label ${selected ? 'selected' : ''} ${central ? 'central' : ''}`} style={{ '--agent': department.color, '--agent-pale': department.pale } as CSSProperties} onClick={onSelect}>
        {selected && <span className="station-eyebrow"><i/>{central ? 'CONTROL TOWER' : department.label.toUpperCase()}</span>}<strong>{agent.name}</strong>
        <span className={`station-status ${agent.status}`}><i/>{statusCopy[agent.status]}{selected && <em>{central ? '5 specialists' : 'Agent desk'}</em>}</span>
      </button>
    </Html>
  </group>;
}

function Vault({ snapshot }: { snapshot: OrderSnapshot }) {
  const state = snapshot.vault.locked ? `${snapshot.vault.locked} LOCKED` : snapshot.vault.paid ? `${snapshot.vault.paid} PAID` : `${snapshot.vault.available} READY`;
  return <group position={[6.3, .1, 1.8]}>
    <Box position={[0, .72, 0]} size={[1.3, 1.45, 1.05]} color="#1b1e23" radius={.09}/><Box position={[0, .75, .535]} size={[1.08, 1.15, .04]} color="#faf7f2" radius={.03}/>
    <mesh position={[0, .76, .565]}><torusGeometry args={[.22, .035, 10, 24]}/><meshStandardMaterial color="#ff6b35"/></mesh><Box position={[0, .43, .568]} size={[.45, .1, .018]} color="#16a394"/>
    <Html center position={[0, 1.68, 0]}><div className="vault-label"><span>PAYMENT VAULT</span><strong>{state} DemoUSD</strong></div></Html>
  </group>;
}

function Connections({ snapshot }: { snapshot: OrderSnapshot }) {
  return <group>{snapshot.agents.filter((agent) => agent.id !== 'manager').map((agent) => <Line key={agent.id} points={[[positions.manager[0], .1, positions.manager[2]], [positions[agent.id][0], .1, positions[agent.id][2]]]} color={['working', 'retrying'].includes(agent.status) ? departments[agent.id].color : '#c4bdd0'} lineWidth={agent.status === 'working' ? 2 : 1} dashed dashSize={.18} gapSize={.14} transparent opacity={.75}/>)}</group>;
}

function Camera({ selected, reset, zoom }: { selected: AgentId; reset: number; zoom: number }) {
  const controls = useRef<any>(null); const { camera, size } = useThree();
  useEffect(() => { const orthographic = camera as THREE.OrthographicCamera; orthographic.zoom = Math.min(size.width / 22, size.height / 14) * zoom; orthographic.updateProjectionMatrix(); }, [camera, size, zoom]);
  useEffect(() => { const position = positions[selected]; controls.current?.target.set(position[0] * .12, .75, position[2] * .12); controls.current?.update(); }, [selected]);
  useEffect(() => { camera.position.set(11, 15, 18); controls.current?.target.set(.5, .75, .25); controls.current?.update(); }, [camera, reset]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableZoom={false} minPolarAngle={.4} maxPolarAngle={1.05} minAzimuthAngle={-.7} maxAzimuthAngle={1.2}/>;
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }; static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="scene-fallback"><strong>3D view unavailable</strong><span>The journey and order inspector are still usable.</span></div> : this.props.children; }
}

export function Scene({ snapshot, selected, onSelect, reset, zoom }: { snapshot: OrderSnapshot; selected: AgentId; onSelect: (id: AgentId) => void; reset: number; zoom: number }) {
  const agents = useMemo(() => snapshot.agents, [snapshot.agents]);
  return <SceneBoundary><Canvas orthographic camera={{ position: [11, 15, 18], zoom: 55, near: .1, far: 100 }} shadows dpr={[1, 1.7]} gl={{ antialias: true }}>
    <color attach="background" args={['#f4f1eb']}/><ambientLight intensity={1.25}/>
    <directionalLight position={[-5, 12, 7]} intensity={1.85} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-bias={-.001}/>
    <group position={[0, .15, 0]}><Warehouse/><Connections snapshot={snapshot}/>{agents.map((agent) => <Station key={agent.id} agent={agent} selected={selected === agent.id} onSelect={() => onSelect(agent.id)}/>)}<Vault snapshot={snapshot}/></group>
    <ContactShadows position={[0, -.25, 0]} opacity={.24} scale={24} blur={2.6} far={9} resolution={512} color="#1b1e23" frames={1}/><Camera selected={selected} reset={reset} zoom={zoom}/>
  </Canvas></SceneBoundary>;
}
