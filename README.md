Bone Marionette Lab — prototype
================================

1. Extract the ZIP.
2. Keep index.html, app.js, and the assets/ folder together.
3. Open index.html in a modern browser. If local browser restrictions affect sensors, serve the folder from HTTPS or localhost.
4. On a phone, press “Enable phone tilt” and grant permission if prompted.
5. Drag near joint locations to pose joints; use Random movement and Reset pose.

The 11 supplied transparent PNGs are included in assets/. The pivot coordinates in app.js are initial estimates and will likely need tuning against the artwork. The app is a lightweight spring-based visual simulation, not a full rigid-body physics engine.
