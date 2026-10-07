# FUXA 3D Cube

Adds a three.js 3D scene to a [FUXA](https://github.com/frangoteam/FUXA) view through open and close scripts: a cube with a shadow, a grid floor, and mouse dragging along the X / Y / Z axes.

## Files

| File | Purpose |
|---|---|
| `3d_Cube.js` | Open script: builds the 3D scene |
| `destroy_Cube.js` | Close script: releases 3D resources when the view closes |

## Setup in FUXA

Menu labels can differ slightly between FUXA versions.

### Step 1: Draw the placeholder rectangle

1. Open the FUXA editor (for example `http://localhost:1881/editor`).
2. In the **Views** list on the left, select the view that should show the cube (or create a new one).
3. Pick the **rectangle** tool and draw a rectangle where the 3D scene should appear. Its position and size become the 3D area.
4. With the rectangle selected, set **Name** to `cube_3d` in the properties panel on the right. It must match `PLACEHOLDER_ID` in `3d_Cube.js` exactly.

### Step 2: Add the open script

1. Open **Scripts** (under the settings menu) and click **+** to add a new script.
2. Name it, for example `cube_open`.
3. Paste in the full contents of `3d_Cube.js`.
4. Set the script **Mode** to **CLIENT**. The default SERVER mode can't reach the browser DOM, so nothing would appear.
5. Save the script.

### Step 3: Add the close script

1. Add another script, for example `cube_close`.
2. Paste in the full contents of `destroy_Cube.js`.
3. Set **Mode** to **CLIENT** and save.

### Step 4: Bind the scripts to the view events

1. In the **Views** list, open the menu next to your view and choose **Property**.
2. Under **Events**, add an event:
   - Type: **Open** (onopen), Action: **Run Script**, Script: `cube_open`
3. Add a second event:
   - Type: **Close** (onclose), Action: **Run Script**, Script: `cube_close`
4. Click OK and save the project.

### Step 5: Test

1. Open the FUXA runtime (for example `http://localhost:1881`) and go to the view.
2. The rectangle should be replaced by the 3D cube after a moment (three.js loads from the CDN on first use).
3. Switch to another view and back. Only one cube should appear, with no leftover canvas.

If nothing appears, press **F12** and check the browser console for messages starting with `[Cube3D]`. A warning that `cube_3d` can't be found usually means the rectangle's Name doesn't match.

## Controls

- **Drag along XYZ**: press and drag on the cube's red / green / blue axis to move it along X / Y / Z (it won't sink below the floor)
- **Rotate the view**: left-drag on empty space
- **Zoom**: mouse wheel

## Settings

At the top of `3d_Cube.js`:

| Constant | Default | Description |
|---|---|---|
| `PLACEHOLDER_ID` | `'cube_3d'` | Name of the placeholder rectangle; must match the name in FUXA |
| `SHOW_AXES` | `false` | Show the XYZ arrows; when hidden, the arrow positions can still be dragged |

## Notes

- three.js (r128) is loaded from cdnjs, so the machine running FUXA needs internet access. On an offline network, change the URL in `loadScript(...)` to a local path.
- The cleanup function is exposed as `window.destroyCube3D`, which the close script calls to release the WebGL context. Even without the close script, the code detects the rectangle disappearing when the view changes and cleans up on its own.
- If the same page runs other 3D scripts, give each one a different `window` cleanup function name so they don't clean up each other.
# fuxa-3d-demo
# fuxa-3d-demo
