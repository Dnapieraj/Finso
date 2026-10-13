import { useEffect, useRef, useState } from "react";

import { useReduceMotion } from "../hooks/use-reduce-motion";
import { AMOUNT_ANIMATION_MS, amountAt, shouldAnimateAmount } from "./amount-animation";

/**
 * The amount to draw while `target` changes: counts smoothly from the old
 * value to the new one. The first value and every change the phone asks
 * not to animate ("Ogranicz ruch", or crossing zero) show at once.
 */
export function useAnimatedAmount(target: number): number {
  const reduceMotion = useReduceMotion();
  const [shown, setShown] = useState(target);
  // The frame loop reads the latest value without restarting on every frame.
  const shownRef = useRef(target);
  const animate = !reduceMotion && shouldAnimateAmount(shown, target);

  useEffect(() => {
    const from = shownRef.current;
    if (reduceMotion || !shouldAnimateAmount(from, target)) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    // performance.now, not Date.now: tests freeze the wall clock for other reasons.
    const start = performance.now();
    let frame = 0;
    const step = () => {
      const value = amountAt({
        from,
        to: target,
        elapsedMs: performance.now() - start,
        durationMs: AMOUNT_ANIMATION_MS,
      });
      shownRef.current = value;
      setShown(value);
      if (value !== target) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target, reduceMotion]);

  // Without an animation the new value draws in the same frame as the
  // words around it, not one render later.
  return animate ? shown : target;
}
