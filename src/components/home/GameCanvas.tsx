interface GameCanvasProps {
  canvasRef: (canvas: HTMLCanvasElement | null) => void;
}

export function GameCanvas({ canvasRef }: GameCanvasProps) {
  return (
    <canvas
      ref={canvasRef}
      width={480}
      height={640}
      className="block h-auto w-full touch-none bg-background"
      aria-label="霓虹深空游戏画布"
    />
  );
}
