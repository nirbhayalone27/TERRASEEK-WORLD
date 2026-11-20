import { useEffect, useState } from "react";
export default function Introduction() {
  const [visible, setVisible] = useState(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return false;
    try {
      return !sessionStorage.getItem("terraseek-intro");
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("terraseek-intro", "1");
    } catch {
      /* Storage is optional. */
    }
    const timer = setTimeout(() => setVisible(false), 1400);
    return () => clearTimeout(timer);
  }, []);
  return visible ? (
    <div className="brand-introduction" aria-hidden="true">
      <span>terraseek.world</span>
    </div>
  ) : null;
}
