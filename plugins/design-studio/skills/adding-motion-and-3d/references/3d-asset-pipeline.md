# 3D asset pipeline

For models that ship on the web. Format is glTF/GLB.

## Before export (Blender or any DCC tool)

1. Apply transforms and modifiers; merge duplicate vertices; remove hidden and unused geometry, materials and textures.
2. Keep triangles under 100k for a whole scene on phones; far fewer for a hero object.
3. UV-unwrap everything; bake complex shader networks into textures, because only a standard PBR material exports.
4. Name objects and animations clearly; animation clips must be on actions, not only on the timeline.
5. Scale: 1 unit equals 1 metre, Y up.

## Export and compress

1. Export GLB with Draco or Meshopt geometry compression. Run `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp` (check the current CLI flags first; for GPU-compressed textures use KTX2).
2. Texture sizes: 512 for props, 1024 for standard, 2048 for a hero only. Pack occlusion, roughness and metallic into one RGB texture.
3. Colour textures are sRGB; data textures (normal, roughness, metallic) are linear. In three.js set `texture.colorSpace = THREE.SRGBColorSpace` on colour maps only.
4. Generate a React component from a GLB with `npx gltfjsx model.glb --transform` when using R3F.

## Load

- Use `useGLTF` with preload for the hero model, behind a poster image.
- Serve with long cache headers and a hashed filename.
- Keep one environment map small (HDR 1k) or use a drei preset.

## Texturing tools

Substance Painter or similar are authoring tools, not a web concern. The only web rules are the ones above: export PBR maps at the sizes in step 2 of the export list, in the right colour space, and compress.
