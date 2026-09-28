import { useEffect, useRef } from "react";
import { channelColor, type ShipDef } from "./game/ships";

interface ShipPreviewProps {
  ship: ShipDef;
  size?: number;
}

/** 机型像素造型预览：小型 canvas 按精灵图逐格绘制，颜色全部来自 CSS token 通道 */
export function ShipPreview({ ship, size = 56 }: ShipPreviewProps) {
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    const cols = ship.sprite[0].length;
    const rows = ship.sprite.length;
    const px = Math.max(2, Math.floor(Math.min(size / cols, size / rows)));
    cv.width = cols * px;
    cv.height = rows * px;
    g.clearRect(0, 0, cv.width, cv.height);
    g.shadowBlur = 5;
    for (let r = 0; r < rows; r++) {
      const row = ship.sprite[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === ".") continue;
        const color = channelColor(ship.channels[ch] ?? "core");
        g.shadowColor = color;
        g.fillStyle = color;
        g.fillRect(c * px, r * px, px, px);
      }
    }
  }, [ship, size]);
  return (
    <canvas
      ref={cvRef}
      width={size}
      height={size}
      className="mx-auto block h-14 w-14"
      aria-hidden
    />
  );
}
