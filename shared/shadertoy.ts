function createShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string
): WebGLShader | undefined {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }
  console.warn(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader); // clean up failed shader
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | undefined {
  const program = gl.createProgram()!;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }
  console.warn(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

const iMouse = { x: 0, y: 0, clickX: 0, clickY: 0 };
let iSpeed_ = 5.0;
let iTime = 0.0;
let prevDrawTime: number | undefined = undefined;

export function setIMouse(
  x: number | null,
  y: number | null,
  clickX: number | null,
  clickY: number | null
) {
  if (x !== null) iMouse.x = x;
  if (y !== null) iMouse.y = y;
  if (clickX !== null) iMouse.clickX = clickX;
  if (clickY !== null) iMouse.clickY = clickY;
}

export function setISpeed_(speed: number) {
  iSpeed_ = speed;
}

function playProgram(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  textureImages: (HTMLImageElement | null)[] = []
) {
  gl.useProgram(program);
  const quadPositions = new Float32Array([
    -1, -1, 1, -1, -1, 1, 1, 1, -1, 1, 1, -1,
  ]); // two triangles to fill the rectangle
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quadPositions, gl.STATIC_DRAW);

  // textures
  // TODO: Support images with non-power-of-two edge lengths
  textureImages.forEach((textureImage, i) => {
    if (!textureImage) {
      return;
    }
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      textureImage
    );
    gl.generateMipmap(gl.TEXTURE_2D);
  });

  let iFrame: number = 0;

  function drawFrame(now: number) {
    if (!prevDrawTime) {
      prevDrawTime = now;
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // uniforms
    const iResolution: [number, number, number] = [
      gl.canvas.width,
      gl.canvas.height,
      1.0,
    ];
    iTime += (now - prevDrawTime!) * 0.001 * iSpeed_;

    function repeat(n: number, arr: any[]): any[] {
      let repeated = [];
      for (let i = 0; i < n; i++) {
        repeated.push(...arr);
      }
      return repeated;
    }

    const iChannelTime = new Float32Array(repeat(4, [iTime]));
    const iChannelResolution = new Float32Array(
      repeat(4, [gl.canvas.width, gl.canvas.height, 0])
    );

    gl.uniform3f(gl.getUniformLocation(program, "iResolution"), ...iResolution);
    gl.uniform1f(gl.getUniformLocation(program, "iTime"), iTime);
    gl.uniform1f(gl.getUniformLocation(program, "iFrameRate"), 60.0);
    gl.uniform1i(gl.getUniformLocation(program, "iFrame"), iFrame);
    gl.uniform1fv(gl.getUniformLocation(program, "iChannelTime"), iChannelTime);
    gl.uniform3fv(
      gl.getUniformLocation(program, "iChannelResolution"),
      iChannelResolution
    );
    gl.uniform1i(gl.getUniformLocation(program, "iChannel0"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "iChannel1"), 1);
    gl.uniform1i(gl.getUniformLocation(program, "iChannel2"), 2);
    gl.uniform1i(gl.getUniformLocation(program, "iChannel3"), 3);
    gl.uniform4f(
      gl.getUniformLocation(program, "iMouse"),
      iMouse.x,
      iMouse.y,
      iMouse.clickX,
      iMouse.clickY
    );

    // draw
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    const vertexInPositionAttrib = gl.getAttribLocation(
      program,
      "vertexInPosition"
    );
    gl.vertexAttribPointer(vertexInPositionAttrib, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexInPositionAttrib);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // maintain timer and counter
    prevDrawTime = now;
    iFrame += 1;
  }

  // animation loop
  function animate(t: number) {
    drawFrame(t);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext
): void {
  if (
    canvas.width == canvas.clientWidth &&
    canvas.height == canvas.clientHeight
  ) {
    return;
  }
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

export function renderShaderToy(
  canvas: HTMLCanvasElement,
  mainImageSource: string,
  textureImages: (HTMLImageElement | null)[] = []
): void {
  const gl = canvas.getContext("webgl2");

  if (!gl) {
    alert("WebGL2 not supported on this device.");
    return;
  }
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  window.addEventListener("resize", () => {
    resizeCanvas(canvas, gl);
  });

  gl.getExtension("OES_texture_float_linear");
  gl.getExtension("OES_texture_half_float_linear");
  gl.getExtension("EXT_color_buffer_float");
  gl.getExtension("WEBGL_debug_shaders");

  // shaders
  const vertexShaderSource = `#version 300 es
  #ifdef GL_ES
  precision highp float;
  precision highp int;
  #endif
  in vec2 vertexInPosition;
  void main() {
    gl_Position = vec4(vertexInPosition, 0.0, 1.0);
  }
  `;

  const shaderToyHeader = `#version 300 es
  #ifdef GL_ES
  precision highp float;
  precision highp int;
  #endif
  #define texture2D texture
  uniform vec3 iResolution;
  uniform float iTime;
  uniform float iFrameRate;
  uniform int iFrame;
  uniform float iChannelTime[4];
  uniform vec3 iChannelResolution[4];
  uniform sampler2D iChannel0;
  uniform sampler2D iChannel1;
  uniform sampler2D iChannel2;
  uniform sampler2D iChannel3;
  uniform vec4 iMouse;
  out vec4 frag_out_color;
  void mainImage( out vec4 fragColor, in vec2 fragCoord );
  void main( void )
  {
    vec4 color = vec4(0.0, 0.0, 0.0, 0.0);
    mainImage(color, gl_FragCoord.xy);
    frag_out_color = vec4(color);
  }
  `;

  const fragmentShaderSource = shaderToyHeader + mainImageSource;

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );
  if (!(vertexShader && fragmentShader)) {
    console.warn("Failed to create shaders");
    return;
  }

  // program
  const program = createProgram(gl, vertexShader, fragmentShader);
  if (!program) {
    console.warn("Failed to create program");
    return;
  }

  playProgram(gl, program, textureImages);
}
