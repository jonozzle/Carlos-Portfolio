// lib/debug/dom-removechild-trace.ts
"use client";

export function installRemoveChildTracer() {
  if (typeof window === "undefined") return;

  const w = window as any;
  if (w.__removeChildTracerInstalled) return;
  w.__removeChildTracerInstalled = true;

  const original = Node.prototype.removeChild as (child: Node) => Node;

  (Node.prototype as any).removeChild = function (this: Node, child: Node) {
    try {
      return original.call(this, child);
    } catch (err) {
      console.group("removeChild NotFoundError");
      console.log("PARENT:", this);
      console.log("CHILD:", child);
      console.trace("STACK");
      console.groupEnd();
      throw err;
    }
  };
}
