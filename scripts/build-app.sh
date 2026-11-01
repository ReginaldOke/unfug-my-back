#!/bin/sh
# Builds the web app into dist/ for the iOS shell: the site as deployed, with three.js copied in
# (the same files the Pages workflow bundles). Then `npx cap sync ios` copies dist/ into the Xcode project.
set -e
cd "$(dirname "$0")/.."
rm -rf dist
cp -R web dist
rm -rf dist/vendor
mkdir -p dist/vendor/three/build dist/vendor/three/examples/jsm/controls dist/vendor/three/examples/jsm/loaders dist/vendor/three/examples/jsm/utils
cp node_modules/three/build/three.module.js node_modules/three/build/three.core.js dist/vendor/three/build/
cp node_modules/three/examples/jsm/controls/OrbitControls.js dist/vendor/three/examples/jsm/controls/
cp node_modules/three/examples/jsm/loaders/OBJLoader.js node_modules/three/examples/jsm/loaders/GLTFLoader.js dist/vendor/three/examples/jsm/loaders/
cp node_modules/three/examples/jsm/utils/BufferGeometryUtils.js node_modules/three/examples/jsm/utils/SkeletonUtils.js dist/vendor/three/examples/jsm/utils/
# Capacitor's runtime, loaded before the app so native.js finds window.Capacitor
cp node_modules/@capacitor/core/dist/capacitor.js dist/vendor/
sed -i.bak 's|<script type="importmap">|<script src="./vendor/capacitor.js"></script>\n  <script type="importmap">|' dist/index.html && rm dist/index.html.bak
echo "Built dist/"
