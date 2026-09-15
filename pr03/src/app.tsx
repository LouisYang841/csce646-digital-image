import React from "react";
import { renderShaderToy, setIMouse, setISpeed_ } from "../../shared/shadertoy";
import { shaderSource } from "./shader";
import { SliderHorizontal } from "./components/slider";
import { GitHubLogoIcon, CodeIcon } from "@radix-ui/react-icons";

export default function App() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.addEventListener("click", (e) => {
      setIMouse(e.offsetX, canvas.height - e.offsetY, null, null);
    });
    const imageSources = [null, "./normal.png", "./dark.png", "./bright.png"];
    loadImages(imageSources).then((images) => {
      renderShaderToy(canvas, shaderSource, images);
    });
  }, []);

  return (
    <div
      className="h-screen w-screen relative"
      style={{
        backgroundImage: "url('./black_hole_40.jpg')",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      {/* sidebar */}
      <div className="bg-black/60 absolute inset-y-0 left-0 w-96 p-12 flex flex-col">
        <h1 className="text-white text-2xl font-bold mb-2">Team Project</h1>
        <p className="text-sm text-white mb-12">
          Theron Smith, Marina Trevino, Tianxiu Zhou
        </p>
        <p className="text-white text-xl mb-12">
          Stars in a swirling galaxy falling into the center of a black hole.
        </p>
        <p className="text-white text-lg italic mb-8">
          Click on the canvas to set the light source to the position of your
          mouse.
          <br />
          Use the slider below to adjust the rotation speed.
        </p>

        <div className="w-full h-6">
          <SliderHorizontal
            min={1}
            max={9}
            defaultValue={[5]}
            onValueChange={(v) => {
              setISpeed_(v[0]);
            }}
          />
        </div>

        <div className="mt-auto flex justify-between text-white text-sm">
          <a
            href="./normal.png"
            target="_blank"
            className="underline-offset-4 hover:underline hover:text-sky-500"
          >
            Normal Map
          </a>
          <a
            href="./bright.png"
            target="_blank"
            className="underline-offset-4 hover:underline hover:text-sky-500"
          >
            Bright Map
          </a>
          <a
            href="./dark.png"
            target="_blank"
            className="underline-offset-4 hover:underline hover:text-sky-500"
          >
            Dark Map
          </a>
          <a
            href="./Black Hole.jpg"
            target="_blank"
            className="underline-offset-4 hover:underline hover:text-sky-500"
          >
            Artwork
          </a>
        </div>
        <div className="mt-2 flex text-white">
          <a
            href="https://github.com/choutianxius/csce646-digital-image"
            target="_blank"
            className="mr-6"
          >
            <GitHubLogoIcon className="w-4 h-4 hover:text-sky-500" />
          </a>
          <a href="./shader-source.txt" target="_blank" className="mr-auto">
            <CodeIcon className="w-4 h-4 hover:text-sky-500" />
          </a>
          <span className="text-sm">Dec. 2024</span>
        </div>
      </div>
      <div className="absolute inset-y-0 left-96 right-0">
        <canvas ref={canvasRef} className="w-full h-full"></canvas>
      </div>
    </div>
  );
}

function loadImages(
  imageSources: (string | null | undefined)[]
): Promise<(HTMLImageElement | null)[]> {
  const promises = imageSources.map((src) => {
    if (!src) {
      return null;
    }
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image at ${src}`));
      img.src = src;
    });
  });

  return Promise.all(promises);
}
