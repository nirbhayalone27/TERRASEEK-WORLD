import { Suspense, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture, Line } from "@react-three/drei";
import { Vector3, BufferGeometry, Float32BufferAttribute, Sphere } from "three";
import type { Place } from "./lib/api";
import { xyz } from "./lib/orbit";
export { xyz } from "./lib/orbit";
type Props = {
  place: Place;
  points: any[];
  track: any[];
  selected?: number;
  following: boolean;
  paused: boolean;
  onSelect: (id: number) => void;
  onInteract: () => void;
  onPick: (lat: number, lon: number) => void;
};
function Earth({
  place,
  points,
  track,
  selected,
  following,
  paused,
  onSelect,
  onInteract,
  onPick,
}: Props) {
  const texture = useTexture("/earth.webp");
  const controls = useRef<any>(null);
  const target = useRef(new Vector3(...xyz(place.lat, place.lon, 3.3)));
  const moving = useRef(true),
    interacting = useRef(false),
    lastInteraction = useRef(0);
  const marker = useRef<any>(null);
  const reduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)"),
    [],
  );
  const geometry = useMemo(() => new BufferGeometry(), []);
  const destinations = useRef<Float32Array>(new Float32Array());
  const ids = useRef<number[]>([]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const next = new Float32Array(
      points.flatMap((p) => xyz(p.lat, p.lon, 1 + p.alt / 6371)),
    );
    if (
      next.length !== destinations.current.length ||
      points.some((p, i) => p.id !== ids.current[i])
    ) {
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(next.slice(), 3),
      );
      geometry.boundingSphere = new Sphere(new Vector3(), 20);
    }
    ids.current = points.map((p) => p.id);
    destinations.current = next;
  }, [points, geometry]);
  useEffect(() => {
    target.current.set(...xyz(place.lat, place.lon, 3.3));
    moving.current = true;
  }, [place]);
  useFrame(({ camera }, dt) => {
    const attribute = geometry.getAttribute("position");
    if (attribute) {
      const a = attribute.array as Float32Array,
        b = destinations.current;
      const alpha = reduced.matches ? 1 : 1 - Math.exp(-dt * 7);
      for (let i = 0; i < a.length; i++) a[i] += (b[i] - a[i]) * alpha;
      attribute.needsUpdate = true;
      const index = ids.current.indexOf(selected!);
      if (marker.current) {
        marker.current.visible = index >= 0;
        if (index >= 0) marker.current.position.fromArray(a, index * 3);
      }
      if (following && index >= 0 && !interacting.current) {
        target.current
          .fromArray(a, index * 3)
          .normalize()
          .multiplyScalar(
            Math.max(2.3, new Vector3().fromArray(a, index * 3).length() + 1.2),
          );
        moving.current = true;
      }
    }
    if (moving.current && !interacting.current) {
      camera.position.lerp(
        target.current,
        reduced.matches ? 1 : 1 - Math.exp(-dt * 3),
      );
      camera.lookAt(0, 0, 0);
      if (camera.position.distanceTo(target.current) < 0.015)
        moving.current = false;
    }
    // Rotate the viewpoint around the Earth-fixed scene, preserving geographic and orbital alignment.
    if (controls.current)
      controls.current.autoRotate =
        !reduced.matches &&
        !paused &&
        !selected &&
        !moving.current &&
        !interacting.current &&
        performance.now() - lastInteraction.current > 5000;
  });
  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[5, 3, 5]} intensity={1.4} />
      <mesh
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          const p = e.point.clone().normalize();
          onPick(
            (Math.asin(p.y) * 180) / Math.PI,
            (Math.atan2(-p.z, p.x) * 180) / Math.PI,
          );
        }}
      >
        <sphereGeometry args={[1, 64, 48]} />
        <meshStandardMaterial map={texture} roughness={0.9} />
      </mesh>
      <points
        geometry={geometry}
        onClick={(e) => {
          e.stopPropagation();
          if (e.index !== undefined && ids.current[e.index] !== undefined)
            onSelect(ids.current[e.index]);
        }}
      >
        <pointsMaterial color="#ac6c27" size={0.012} sizeAttenuation />
      </points>
      <mesh ref={marker} visible={false}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshBasicMaterial color="#087d78" />
      </mesh>
      {track.length > 1 && (
        <>
          <Line
            points={track.map((p) => xyz(p.lat, p.lon, 1 + p.alt / 6371))}
            color="#b67a31"
            lineWidth={1.4}
          />
          <Line
            points={track.map((p) => xyz(p.lat, p.lon, 1.003))}
            color="#087d78"
            lineWidth={1}
            dashed
            dashSize={0.025}
            gapSize={0.012}
          />
        </>
      )}
      <mesh position={xyz(place.lat, place.lon, 1.012)}>
        <sphereGeometry args={[0.009, 12, 12]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
      <OrbitControls
        ref={controls}
        enablePan={false}
        minDistance={1.3}
        maxDistance={12}
        autoRotateSpeed={0.18}
        onStart={() => {
          moving.current = false;
          interacting.current = true;
          onInteract();
        }}
        onEnd={() => {
          interacting.current = false;
          lastInteraction.current = performance.now();
        }}
        enableDamping
      />
    </>
  );
}
export default function Globe(props: Props) {
  return (
    <Canvas
      camera={{ position: xyz(20, 70, 3.3), fov: 42 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ raycaster }) => {
        raycaster.params.Points = { threshold: 0.018 };
      }}
    >
      <Suspense fallback={null}>
        <Earth {...props} />
      </Suspense>
    </Canvas>
  );
}
