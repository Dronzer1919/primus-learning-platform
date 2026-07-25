// Browser no-op stub for the Node-only "source-map-support" package.
//
// TypeScript's compiler bundle calls `require("source-map-support").install()`
// (tryEnableSourceMapsForHost) which is meaningless in the browser. The build
// leaves that as an external bare import; an import map in index.html points the
// "source-map-support" specifier here so the lazily-loaded typescript chunk can
// resolve it instead of failing with "Failed to resolve module specifier".
export function install() {
  /* no-op in the browser */
}

export default { install };
