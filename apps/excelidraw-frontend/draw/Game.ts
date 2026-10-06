import { Tool } from "@/components/Canvas";
import { getExistingShapes } from "./http";

type Point = { x: number, y: number };

type Shape = {
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    strokeWidth: number;
} | {
    type: "circle";
    centerX: number;
    centerY: number;
    radius: number;
    color: string;
    strokeWidth: number;
} | {
    type: "path";
    points: Point[];
    color: string;
    strokeWidth: number;
} | {
    type: "eraser";
    points: Point[];
    strokeWidth: number;
}

export class Game {

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private existingShapes: Shape[]
    private roomId: string;
    private clicked: boolean;
    private startX = 0;
    private startY = 0;
    private selectedTool: Tool = "circle";
    private selectedColor: string = "rgba(255, 255, 255, 1)";
    private selectedStrokeWidth: number = 2;
    private history: Shape[][] = [];
    private historyIndex = -1;

    socket: WebSocket;

    constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d")!;
        this.existingShapes = [];
        this.roomId = roomId;
        this.socket = socket;
        this.clicked = false;
        this.init();
        this.initHandlers();
        this.initMouseHandlers();
    }

    destroy() {
        this.canvas.removeEventListener("mousedown", this.mouseDownHandler)
        this.canvas.removeEventListener("mouseup", this.handlePathMouseUp)
        this.canvas.removeEventListener("mousemove", this.mouseMoveHandler)
    }

    setTool(tool: Tool, color?: string, width?: number) {
        this.selectedTool = tool;
        if (color) this.selectedColor = color;
        if (width) this.selectedStrokeWidth = width;
    }

    async init() {
        this.existingShapes = await getExistingShapes(this.roomId);
        this.saveHistory();
        this.clearCanvas();
    }

    initHandlers() {
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type == "chat") {
                const parsedShape = JSON.parse(message.message)
                this.existingShapes.push(parsedShape.shape)
                this.saveHistory();
                this.clearCanvas();
            }
        }
    }

    saveHistory() {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push([...this.existingShapes]);
        this.historyIndex++;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.existingShapes = [...this.history[this.historyIndex]];
            this.clearCanvas();
            return true;
        }
        return false;
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.existingShapes = [...this.history[this.historyIndex]];
            this.clearCanvas();
            return true;
        }
        return false;
    }

    exportAsPNG() {
        const link = document.createElement('a');
        link.download = `excelidraw-${this.roomId}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.existingShapes.forEach((shape) => {
            this.ctx.strokeStyle = shape.color || "white";
            this.ctx.lineWidth = shape.strokeWidth || 2;
            this.ctx.lineCap = "round";
            this.ctx.lineJoin = "round";

            if (shape.type === "rect") {
                this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
            } else if (shape.type === "circle") {
                this.ctx.beginPath();
                this.ctx.arc(shape.centerX, shape.centerY, Math.abs(shape.radius), 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (shape.type === "path") {
                this.ctx.beginPath();
                this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
                shape.points.forEach(p => this.ctx.lineTo(p.x, p.y));
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (shape.type === "eraser") {
                this.ctx.globalCompositeOperation = "destination-out";
                this.ctx.beginPath();
                this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
                shape.points.forEach(p => this.ctx.lineTo(p.x, p.y));
                this.ctx.stroke();
                this.ctx.closePath();
                this.ctx.globalCompositeOperation = "source-over";
            }
        })
    }

    mouseDownHandler = (e) => {
        this.clicked = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
    }

    mouseUpHandler = (e) => {
        this.clicked = false;
        const width = e.clientX - this.startX;
        const height = e.clientY - this.startY;

        const selectedTool = this.selectedTool;
        let shape: Shape | null = null;

        if (selectedTool === "rect") {
            shape = {
                type: "rect",
                x: this.startX,
                y: this.startY,
                height,
                width,
                color: this.selectedColor,
                strokeWidth: this.selectedStrokeWidth
            }
        } else if (selectedTool === "circle") {
            const radius = Math.max(width, height) / 2;
            shape = {
                type: "circle",
                radius: radius,
                centerX: this.startX + radius,
                centerY: this.startY + radius,
                color: this.selectedColor,
                strokeWidth: this.selectedStrokeWidth
            }
        }

        if (shape) {
            this.existingShapes.push(shape);
            this.saveHistory();
            this.socket.send(JSON.stringify({
                type: "chat",
                message: JSON.stringify({ shape }),
                roomId: this.roomId
            }));
        }
    }

    private currentPath: Point[] = [];

    mouseMoveHandler = (e) => {
        if (!this.clicked) return;

        const x = e.clientX;
        const y = e.clientY;

        if (this.selectedTool === "rect" || this.selectedTool === "circle") {
            const width = x - this.startX;
            const height = y - this.startY;
            this.clearCanvas();
            this.ctx.strokeStyle = this.selectedColor;
            this.ctx.lineWidth = this.selectedStrokeWidth;
            if (this.selectedTool === "rect") {
                this.ctx.strokeRect(this.startX, this.startY, width, height);
            } else if (this.selectedTool === "circle") {
                const radius = Math.max(width, height) / 2;
                this.ctx.beginPath();
                this.ctx.arc(this.startX + radius, this.startY + radius, Math.abs(radius), 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.closePath();
            }
        } else if (this.selectedTool === "pencil" || this.selectedTool === "marker" || this.selectedTool === "eraser") {
            if (this.currentPath.length === 0) {
                this.currentPath.push({ x, y });
            }
            this.currentPath.push({ x, y });

            this.clearCanvas();

            if (this.selectedTool === "eraser") {
                this.ctx.globalCompositeOperation = "destination-out";
                this.ctx.lineWidth = this.selectedStrokeWidth * 4;
            } else {
                this.ctx.globalCompositeOperation = "source-over";
                this.ctx.strokeStyle = this.selectedColor;
                this.ctx.lineWidth = this.selectedTool === "marker" ? this.selectedStrokeWidth * 5 : this.selectedStrokeWidth;
                if (this.selectedTool === "marker") {
                    this.ctx.globalAlpha = 0.4;
                }
            }

            this.ctx.beginPath();
            this.ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
            this.currentPath.forEach(p => this.ctx.lineTo(p.x, p.y));
            this.ctx.stroke();
            this.ctx.closePath();
            this.ctx.globalAlpha = 1.0;
            this.ctx.globalCompositeOperation = "source-over";
        }
    }

    handlePathMouseUp = (e: any) => {
        if (this.currentPath.length === 0) return;

        let shape: Shape | null = null;
        if (this.selectedTool === "pencil") {
            shape = {
                type: "path",
                points: [...this.currentPath],
                color: this.selectedColor,
                strokeWidth: this.selectedStrokeWidth
            };
        } else if (this.selectedTool === "marker") {
            shape = {
                type: "path",
                points: [...this.currentPath],
                color: this.selectedColor,
                strokeWidth: this.selectedStrokeWidth * 5
            };
        } else if (this.selectedTool === "eraser") {
            shape = {
                type: "eraser",
                points: [...this.currentPath],
                strokeWidth: this.selectedStrokeWidth * 4
            };
        }

        if (shape) {
            this.existingShapes.push(shape);
            this.saveHistory();
            this.socket.send(JSON.stringify({
                type: "chat",
                message: JSON.stringify({ shape }),
                roomId: this.roomId
            }));
        }

        this.currentPath = [];
    }

    initMouseHandlers() {
        this.canvas.addEventListener("mousedown", this.mouseDownHandler);
        this.canvas.addEventListener("mouseup", this.handlePathMouseUp);
        this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
    }
}
