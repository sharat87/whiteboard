import m from "mithril"
import { fabric } from "fabric"

window.addEventListener("load", main)

const COLORS = {
	// Colors from <https://clrs.cc/>.
	"Navy":    "#001F3F",
	"Blue":    "#0074D9",
	"Aqua":    "#7FDBFF",
	"Teal":    "#39CCCC",
	"Olive":   "#3D9970",
	"Green":   "#2ECC40",
	"Lime":    "#01FF70",
	"Yellow":  "#FFDC00",
	"Orange":  "#FF851B",
	"Red":     "#FF4136",
	"Maroon":  "#85144B",
	"Fuchsia": "#F012BE",
	"Purple":  "#B10DC9",
	"Black":   "#111111",
	"Gray":    "#AAAAAA",
	"Silver":  "#DDDDDD",
}

function main() {
	m.mount(document.getElementById("root") as Element, RootView)
}

const Tools = {
	Pencil: {
		name: "pencil",
	},
	Select: {
		name: "select",
	},
	Rect: {
		name: "shape",
		shape: "Rect",
		create() {
			return new fabric.Rect({ width: 0, height: 0 })
		},
		update(s: any, w: any, h: any) {
			s.set("width", w).set("height", h)
		},
	},
	Ellipse: {
		name: "shape",
		shape: "Ellipse",
		create() {
			return new fabric.Ellipse({ rx: 0, ry: 0 })
		},
		update(s: any, w: any, h: any) {
			s.set("rx", w/2).set("ry", h/2)
		},
	},
}

class Model {
	canvas: any
	initialWidth: number
	initialHeight: number
	undoHistory: any[]
	undoPosition: number
	tool: any
	fillColor: string

	constructor() {
		this.canvas = null

		this.initialWidth = Math.floor(document.documentElement.clientWidth * .9)
		this.initialHeight = document.documentElement.clientHeight - 180

		this.undoHistory = []
		this.undoPosition = 0

		this.tool = Tools.Pencil
		this.fillColor = "#CCCCCC"
	}
}

function RootView() {
	const model = new Model()

	return { view }

	function view() {
		return [
			model.canvas != null && m(ControlPanel, { model }),
			m(FabricCanvas, { model }),
			m(".controls", [
				m(
					"button",
					{
						onclick() {
							model.canvas.setHeight(model.canvas.getHeight() + model.initialHeight)
						},
					},
					m.trust("&darr; Extend &darr;"),
				),
			]),
			// JSON view of model: m("pre", JSON.stringify({ ...model, canvas: null }, null, 4)),
		]
	}
}

function ControlPanel() {
	return { view }

	function view(vnode: m.VnodeDOM<{ model: Model }>) {
		const { model } = vnode.attrs
		return m(".controls", [
			m(
				"button",
				{
					class: model.tool.name === "select" ? "active" : "",
					onclick() {
						model.tool = Tools.Select
					},
				},
				"Select",
			),
			m(
				"button",
				{
					class: model.tool.name === "pencil" ? "active" : "",
					onclick() {
						model.tool = Tools.Pencil
					},
				},
				"Pencil",
			),
			m(
				"button",
				{
					class: model.tool.name === "shape" && model.tool.shape === "Rect" ? "active" : "",
					onclick() {
						model.tool = Tools.Rect
					},
				},
				"Rectangle",
			),
			m(
				"button",
				{
					class: model.tool.name === "shape" && model.tool.shape === "Ellipse" ? "active" : "",
					onclick() {
						model.tool = Tools.Ellipse
					},
				},
				"Ellipse",
			),
			// TODO: Undo/Redo only works for adding new paths. No operations in select mode have undo today.
			m(
				"button",
				{
					disabled: !(model.undoHistory.length > 0 && model.undoPosition > 0),
					onclick() {
						model.canvas.remove(model.undoHistory[--model.undoPosition].path)
					},
				},
				"Undo",
			),
			m(
				"button",
				{
					disabled: !(model.undoHistory.length > 0 && model.undoPosition < model.undoHistory.length),
					onclick() {
						model.canvas.add(model.undoHistory[model.undoPosition++].path)
					},
				},
				"Redo",
			),
			m("label", [
				m("span.title", "Stroke"),
				m(
					"select",
					{
						value: model.canvas.freeDrawingBrush.color,
						onchange(event: any) {
							model.canvas.freeDrawingBrush.color = event.target.value
						},
					},
					Object.entries(COLORS).map(([name, value]) => m("option", { value }, name)),
				),
			]),
			m("button", {
				onclick() {
					const el = document.createElement("a")
					el.setAttribute("href", model.canvas.toDataURL())
					el.setAttribute("download", "whiteboard.png")
					el.style.position = "fixed"
					el.style.pointerEvents = "none"
					el.style.opacity = "0"
					el.style.top = "0"
					document.body.appendChild(el)
					el.click()
					setTimeout(el.remove.bind(el), 200)
				},
			}, "Download PNG"),
		])
	}
}

function FabricCanvas() {
	interface Attrs {
		model: Model
	}

	return { oncreate, view }

	function oncreate(vnode: m.VnodeDOM<Attrs>) {
		const { model } = vnode.attrs

		const canvas = model.canvas = new fabric.Canvas(vnode.dom.querySelector("canvas"))
		m.redraw()

		canvas.setWidth(model.initialWidth)
		canvas.setHeight(model.initialHeight)

		canvas.freeDrawingBrush.width = 3
		canvas.freeDrawingBrush.color = COLORS.Black

		canvas.on("path:created", (event: any) => onCanvasEvent(model, "path:created", event))
		// Undo for more events: canvas.on("object:modified", (event) => onCanvasEvent(model, "object:modified", event))

		let started = false
		let x = 0
		let y = 0

		// TODO: When we do just a click, it still creates a shape of zero size.
		// TODO: Dragging from bottom-left to top-right creates shape in the wrong place.
		canvas.on("mouse:down", (event: any) => {
			if (canvas.getActiveObject() || model.tool.name !== "shape") {
				return false
			}

			started = true
			x = event.e.clientX - event.e.target.offsetParent.offsetLeft
			y = event.e.clientY - event.e.target.offsetParent.offsetTop

			const shape = model.tool.create()
			shape.set("left", x)
			shape.set("top", y)
			shape.set("fill", model.fillColor)
			shape.set("stroke", model.canvas.freeDrawingBrush.color)

			canvas.add(shape)
			canvas.setActiveObject(shape)
		})

		canvas.on("mouse:move", (event: any) => {
			if (!started) {
				return false
			}

			const w = Math.abs(event.e.clientX - event.e.target.offsetParent.offsetLeft - x)
			const h = Math.abs(event.e.clientY - event.e.target.offsetParent.offsetTop - y)

			if (!w || !h) {
				return false
			}

			const shape = canvas.getActiveObject()
			model.tool.update(shape, w, h)
		})

		canvas.on("mouse:up", () => {
			if (!started) {
				return false
			}

			if (started) {
				started = false
			}

			const shape = canvas.getActiveObject()
			canvas.add(shape)
		})

	}

	function onCanvasEvent(model: Model, eventName: string, event: any) {
		console.log(eventName, event)
		model.undoHistory.splice(model.undoPosition, model.undoHistory.length - model.undoPosition, event)
		++model.undoPosition
		m.redraw()
	}

	function view(vnode: m.VnodeDOM<Attrs>): m.Children {
		const { model } = vnode.attrs
		if (model.canvas != null) {
			model.canvas.isDrawingMode = model.tool.name === "pencil"
		}
		return m("div", m("canvas"))
	}
}
