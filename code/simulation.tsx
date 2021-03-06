// See https://github.com/safetyscore/simulation for the source repo.

// Determine host environment.
const IN_BROWSER = typeof self === "object"
const IN_WORKER = typeof importScripts === "function"

// Attribute values for clusters.
const CLUSTER_PUBLIC = 1
const CLUSTER_SAFEGUARDED = 2

// Time spent in clusters during a day.
const CLUSTER_PERIODS = 8

// User interface colours.
const COLOUR_DEAD = "#000000"
const COLOUR_HEALTHY = "#8bb4b8"
const COLOUR_INFECTED = "#ff3945"
const COLOUR_RECOVERED = "#009d51"

// Intervention methods.
const METHOD_APPLE_GOOGLE = 1
const METHOD_FREE_MOVEMENT = 2
const METHOD_LOCKDOWN = 3
const METHOD_SAFETYSCORE = 4

// Method colours for use in graphs.
const METHOD_COLOURS: Record<number, string> = {
  [METHOD_APPLE_GOOGLE]: COLOUR_INFECTED,
  [METHOD_FREE_MOVEMENT]: COLOUR_HEALTHY,
  [METHOD_LOCKDOWN]: "#444444",
  [METHOD_SAFETYSCORE]: COLOUR_RECOVERED,
}

// Short method labels for use in graphs.
const METHOD_LABELS: Record<number, string> = {
  [METHOD_APPLE_GOOGLE]: "Apple/Google",
  [METHOD_FREE_MOVEMENT]: "Free Movement",
  [METHOD_LOCKDOWN]: "Lockdown",
  [METHOD_SAFETYSCORE]: "SafetyScore",
}

// Attribute values for people.
const PERSON_APP_FOREIGN_CLUSTER = 1
const PERSON_APP_INSTALLED = 2
const PERSON_APP_OWN_CLUSTER = 4
const PERSON_KEY_WORKER = 8
const PERSON_SYMPTOMATIC = 16

// Sort orders.
const SORT_ASCENDING = 1
const SORT_DESCENDING = 2

// Status values.
const STATUS_HEALTHY = 1
const STATUS_INFECTED = 2
const STATUS_CONTAGIOUS = 4
const STATUS_RECOVERED = 8
const STATUS_IMMUNE = 16
const STATUS_DEAD = 32
const STATUS_ISOLATED = 64
const STATUS_QUARANTINED = 128

// SVG namespace.
const SVG = "http://www.w3.org/2000/svg"

// Visual ordering of methods.
const METHODS = [
  METHOD_FREE_MOVEMENT,
  METHOD_APPLE_GOOGLE,
  METHOD_SAFETYSCORE,
  METHOD_LOCKDOWN,
]

let ctrl: Controller
let overlayShown = false
let parentPort: MessagePort & NodeEventEmitter

let $config: HTMLTextAreaElement
let $mirror: HTMLPreElement

declare namespace JSX {
  interface IntrinsicElements {
    a: ElemProps
    div: ElemProps
    img: ElemProps
    span: ElemProps
    strong: ElemProps
    sub: ElemProps
    sup: ElemProps
    table: ElemProps
    tbody: ElemProps
    td: ElemProps
    th: ElemProps
    thead: ElemProps
    tr: ElemProps
  }
}

declare namespace Prism {
  function highlight(code: string, lang: string): string
  let languages: Record<string, string>
}

interface BoxPlot {
  max: number
  median: number
  min: number
  q1: number
  q3: number
  size: number
}

interface Cluster {
  attrs: number
  members: number[]
}

interface Computed {
  dailyForeign: number
  dailyTests: number
  inactivityPenalty: number
  infectiousDays: number
  installForeign: number
  traceDays: number
}

interface Config {
  appleGoogleInstalled: number
  clusterCount: Distribution
  clusterSize: Distribution
  dailyTestCapacity: number
  days: number
  exposedVisit: number
  fatalityRisk: number
  foreignImports: number
  groupSize: Distribution
  household: Distribution
  illness: Distribution
  immunity: Distribution
  infectionRisk: number
  installForeign: number
  installOwn: number
  installHousehold: boolean
  isolateHousehold: boolean
  isolationDays: number
  isolationEffectiveness: number
  isolationLikelihood: number
  isolationLockdown: number
  isolationThreshold: number
  isolationSymptomatic: number
  keyWorkers: number
  lockdownEnd: number
  lockdownEndWindow: number
  lockdownStart: number
  imageFont: string
  population: number
  preInfectiousDays: number
  preSymptomaticInfectiousDays: number
  publicClusters: number
  runsMax: number
  runsMin: number
  runsVariance: number
  safeguardThreshold: number
  safeguardedClusters: number
  safetyScoreInstalled: number
  secondDegreeWeight: number
  selfAttestation: number
  symptomatic: number
  testDelay: Distribution
  testKeyWorker: number
  testKeyWorkers: boolean
  testNotified: number
  testSymptomatic: number
  vaccinated: number
  visitForeignCluster: number
  visitPublicCluster: number
}

interface Distribution {
  sample(rng: RNG): number
  max: number
}

interface ElemProps {
  onclick?: (ev: Event) => void
  alt?: string
  height?: number | string
  href?: string
  class?: string
  src?: string
  title?: string
  width?: string
}

interface NodeEventEmitter {
  on(eventName: string, listener: any): NodeEventEmitter
}

interface RNGGroup {
  additionalCluster: RNG
  appInstalled: RNG
  clusterCount: RNG
  clusterSize: RNG
  exposedVisit: RNG
  fatality: RNG
  foreign: RNG
  groupSize: RNG
  household: RNG
  illness: RNG
  immunity: RNG
  infect: RNG
  init: RNG
  installForeign: RNG
  installOwn: RNG
  isolationEffectiveness: RNG
  isolationLikelihood: RNG
  isolationLockdown: RNG
  isolationSymptomatic: RNG
  keyWorker: RNG
  publicClusters: RNG
  selectOwnCluster: RNG
  selectPrivateCluster: RNG
  selectPublicCluster: RNG
  selfAttestation: RNG
  shuffle: RNG
  shuffleGroup: RNG
  symptomatic: RNG
  testDelay: RNG
  testKeyWorker: RNG
  testNotified: RNG
  testSymptomatic: RNG
  vaccinated: RNG
  visitForeignCluster: RNG
  visitPublicCluster: RNG
}

interface Stats {
  dead: number
  healthy: number
  immune: number
  infected: number
  installed: number
  isolated: number
  isolatedPeriods: number
  lockdown: boolean
  r: number
  recovered: number
  uhealthy: number
}

interface Summary {
  days: number
  dead: number
  healthy: number
  idx: number
  infected: number
  isolated: number
  population: number
  rand: number
}

interface SummaryBoxPlot {
  dead: BoxPlot
  healthy: BoxPlot
  infected: BoxPlot
  isolated: BoxPlot
}

interface WorkerRequest {
  definition: string
  method: number
  rand: number
}

interface WorkerResponse {
  rand: number
  stats: Stats
}

class AbstractedWorker {
  worker: Worker & NodeEventEmitter

  constructor(src: string) {
    if (IN_BROWSER) {
      this.worker = new Worker(src) as Worker & NodeEventEmitter
    } else {
      const {Worker} = require("worker_threads")
      this.worker = new Worker(src)
    }
  }

  onMessage(handler: (req: WorkerResponse) => void) {
    if (IN_BROWSER) {
      this.worker.onmessage = (e) => {
        handler(e.data)
      }
    } else {
      this.worker.on("message", handler)
    }
  }

  postMessage(req: WorkerRequest) {
    this.worker.postMessage(req)
  }

  terminate() {
    this.worker.terminate()
  }
}

class BarChart {
  ctrl: Controller
  data: Record<number, SummaryBoxPlot>
  dirty: boolean
  height: number
  inner: number
  labelHeight: number
  padLabel: number
  padLeft: number
  padTop: number
  top: number
  width: number
  $content: HTMLElement
  $graph: SVGElement
  $root: HTMLElement

  constructor(ctrl: Controller) {
    this.ctrl = ctrl
    this.data = {}
    this.dirty = true
    this.height = 320
    this.labelHeight = 40
    this.padLabel = 25
    this.padLeft = 60
    this.padTop = 45
    this.top = this.height - this.labelHeight + 1
    this.inner = this.top - this.padTop
    this.width = 0
  }

  drawBars(
    $graph: SVGElement,
    font: string,
    key: keyof SummaryBoxPlot,
    label: string,
    midX: number
  ) {
    // Draw the X-axis label.
    addNode($graph, "text", {
      "alignment-baseline": "middle",
      "font-family": font,
      "font-size": "12px",
      "text-anchor": "middle",
      x: midX,
      y: this.height - this.labelHeight + this.padLabel,
    }).innerHTML = `% ${label} (Median)`
    // Draw the bars for the different methods.
    const start = midX - 160
    for (let i = 0; i < METHODS.length; i++) {
      const method = METHODS[i]
      const data = this.data[method]
      if (typeof data === "undefined") {
        continue
      }
      const median = data[key].median
      const height = Math.round((median / 100) * this.inner)
      const posX = start + i * 80
      const posY = this.top - height
      addNode($graph, "rect", {
        fill: METHOD_COLOURS[method],
        height: height,
        width: 50,
        x: posX,
        y: posY,
      })
      addNode($graph, "text", {
        "alignment-baseline": "middle",
        "font-family": font,
        "font-size": "11px",
        "text-anchor": "middle",
        x: posX + 25,
        y: posY - 12,
      }).innerHTML = METHOD_LABELS[method]
      addNode($graph, "text", {
        "alignment-baseline": "middle",
        "font-family": font,
        "font-size": "11px",
        "text-anchor": "middle",
        x: posX + 25,
        y: posY - 12 - 17,
      }).innerHTML = `${decimal(median)}%`
    }
  }

  downloadGraph(format: string) {
    const filename = this.getFilename(format)
    const height = this.height
    const width = 840
    const graph = document.createElementNS(SVG, "svg")
    graph.setAttribute("height", "100%")
    graph.setAttribute("viewBox", `0 0 ${width} ${height}`)
    graph.setAttribute("width", "100%")
    this.generateGraph(graph, height, width)
    const svg = new XMLSerializer().serializeToString(graph)
    downloadImage({filename, format, height: height * 2, svg, width: width * 2})
  }

  generateGraph($graph: SVGElement, height: number, width: number) {
    addNode($graph, "rect", {
      fill: "#fff",
      height: height,
      width: width,
      x: 0,
      y: 0,
    })
    const font = this.ctrl.cfg.imageFont
    const midX = Math.floor((width - this.padLeft) / 4)
    const segment = midX * 2
    const ventile = (height - this.labelHeight - this.padTop) / 5
    // Draw the Y-axis labels.
    let posY = this.padTop
    for (let i = 5; i >= 0; i--) {
      addNode($graph, "text", {
        "alignment-baseline": "middle",
        "font-family": font,
        "font-size": "12px",
        "text-anchor": "end",
        x: 40,
        y: posY + 2,
      }).innerHTML = `${i * 20}`
      addNode($graph, "rect", {
        x: 48,
        y: posY,
        width: 5,
        height: 1,
      })
      posY += ventile
    }
    // Draw the Y-axis line.
    posY = posY - ventile + 1
    addNode($graph, "rect", {
      x: 53,
      y: this.padTop,
      width: 1,
      height: posY - this.padTop,
    })
    // Draw the info on healthy.
    this.drawBars($graph, font, "healthy", "Healthy", midX + this.padLeft)
    // Draw the info on isolated.
    this.drawBars(
      $graph,
      font,
      "isolated",
      "Isolated",
      segment + midX + this.padLeft
    )
  }

  getFilename(ext: string) {
    return `simulation-overview-${Date.now()}.${ext}`
  }

  markDirty() {
    this.dirty = true
    this.ctrl.requestRedraw()
  }

  render() {
    if (overlayShown || !this.dirty) {
      return
    }
    this.dirty = false
    this.renderGraph()
  }

  renderGraph() {
    const $graph = this.$graph
    $graph.innerHTML = ""
    this.generateGraph($graph, this.height, this.width)
  }

  reset() {
    this.data = {}
    this.dirty = true
  }

  setDimensions() {
    if (!IN_BROWSER) {
      return
    }
    let width = this.$root.offsetWidth
    if (width < 800) {
      width = 800
    }
    const buffer = 238
    if (width > 800 + 238) {
      this.$content.style.paddingLeft = `${buffer}px`
      width -= buffer
    } else {
      this.$content.style.paddingLeft = "0px"
    }
    this.$graph.setAttribute("viewBox", `0 0 ${width} ${this.height}`)
    this.width = width
    this.markDirty()
  }

  setupUI() {
    const $downloadPNG = (
      <div class="action">
        <img src="download.svg" alt="Download" />
        <span>Download PNG</span>
      </div>
    )
    $downloadPNG.addEventListener("click", () => this.downloadGraph("png"))
    const $downloadSVG = (
      <div class="action">
        <img src="svg.svg" alt="svg" />
        <span>Download SVG</span>
      </div>
    )
    $downloadSVG.addEventListener("click", () => this.downloadGraph("svg"))
    const $graph = document.createElementNS(SVG, "svg")
    $graph.setAttribute("height", `${this.height}`)
    $graph.setAttribute("preserveAspectRatio", "none")
    $graph.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`)
    $graph.setAttribute("width", "100%")
    const $content = <div class="content">{$graph}</div>
    const $root = (
      <div class="simulation">
        <div class="heading"></div>
        {$downloadSVG}
        {$downloadPNG}
        <div class="clear"></div>
        {$content}
        <div class="clear"></div>
      </div>
    )
    this.$content = $content
    this.$graph = $graph
    this.$root = $root
    return $root
  }

  update(method: number, info?: SummaryBoxPlot) {
    this.dirty = true
    if (info) {
      this.data[method] = info
    } else {
      delete this.data[method]
    }
  }
}

class Comparison {
  ctrl: Controller
  data: Record<number, BoxPlot>
  dirty: boolean
  handle?: ReturnType<typeof setTimeout>
  height: number
  key: keyof SummaryBoxPlot
  label: string
  max: number
  sort: number
  width: number
  $graph: SVGElement
  $info: HTMLElement
  $root: HTMLElement
  $summary: HTMLElement

  constructor(
    ctrl: Controller,
    key: keyof SummaryBoxPlot,
    label: string,
    sort: number
  ) {
    this.ctrl = ctrl
    this.data = {}
    this.dirty = false
    this.height = 300
    this.key = key
    this.label = label
    this.max = 0
    this.sort = sort
    this.width = 0
  }

  downloadGraph(format: string) {
    const filename = this.getFilename(format)
    const height = 300
    const width = 760
    const graph = document.createElementNS(SVG, "svg")
    graph.setAttribute("height", "100%")
    graph.setAttribute("viewBox", `0 0 ${width} ${height}`)
    graph.setAttribute("width", "100%")
    this.generateGraph(graph, height, width)
    const svg = new XMLSerializer().serializeToString(graph)
    downloadImage({filename, format, height: height * 2, svg, width: width * 2})
  }

  generateGraph($graph: SVGElement, height: number, width: number) {
    addNode($graph, "rect", {
      fill: "#eeeeee",
      height: height,
      width: width,
      x: 0,
      y: 0,
    })
    if (this.max === 0) {
      return
    }
    const font = this.ctrl.cfg.imageFont
    const methodLabelHeight = 30
    const padMethodLabel = 15
    const padLeft = 60
    const padTop = 25
    const midX = Math.floor((width - padLeft) / 8)
    const segment = midX * 2
    const ventiles = Math.ceil(this.max / 20)
    const ventile = (height - methodLabelHeight - padTop) / ventiles
    // Draw the Y-axis labels.
    let posY = padTop
    for (let i = ventiles; i >= 0; i--) {
      addNode($graph, "text", {
        "alignment-baseline": "middle",
        "font-family": font,
        "font-size": "12px",
        "text-anchor": "end",
        x: 40,
        y: posY + 2,
      }).innerHTML = `${i * 20}`
      addNode($graph, "rect", {
        x: 48,
        y: posY,
        width: 5,
        height: 1,
      })
      posY += ventile
    }
    // Draw the Y-axis line.
    posY = posY - ventile + 1
    addNode($graph, "rect", {
      x: 53,
      y: padTop,
      width: 1,
      height: posY - padTop,
    })
    const top = height - methodLabelHeight
    const y = top - padTop
    for (let i = 0; i < METHODS.length; i++) {
      const method = METHODS[i]
      const box = this.data[method]
      if (typeof box === "undefined") {
        continue
      }
      // Draw the X-axis label.
      const mid = i * segment + midX + padLeft
      addNode($graph, "text", {
        "alignment-baseline": "middle",
        "font-family": font,
        "font-size": "12px",
        "text-anchor": "middle",
        x: mid,
        y: height - methodLabelHeight + padMethodLabel,
      }).innerHTML = METHOD_LABELS[method]
      // Draw the median.
      const medianY = top - y * (box.median / 100)
      addNode($graph, "rect", {
        x: mid - 9,
        y: medianY,
        width: 20,
        height: 3,
      })
      // Label the median.
      addNode($graph, "text", {
        "alignment-baseline": "middle",
        "font-family": font,
        "font-size": "12px",
        x: mid + 20,
        y: medianY + 2,
      }).innerHTML = `${decimal(box.median)}%`
      // Draw the top whisker.
      let rheight = Math.max(1, y * ((box.max - box.q3) / 100))
      const topY = top - y * (box.max / 100)
      if (medianY - topY > 2) {
        addNode($graph, "rect", {
          x: mid,
          y: topY,
          width: 2,
          height: rheight,
        })
      }
      // Draw the bottom whisker.
      const bottomY = top - y * (box.q1 / 100)
      rheight = Math.max(1, y * ((box.q1 - box.min) / 100))
      if (bottomY + rheight - medianY > 5) {
        addNode($graph, "rect", {
          x: mid,
          y: bottomY,
          width: 2,
          height: rheight,
        })
      }
    }
  }

  getFilename(ext: string) {
    return `simulation-${this.key}-${Date.now()}.${ext}`
  }

  hideInfo() {
    if (this.handle) {
      clearTimeout(this.handle)
      this.handle = undefined
    }
    hide(this.$info)
  }

  markDirty() {
    this.dirty = true
    this.ctrl.requestRedraw()
  }

  render() {
    if (!IN_BROWSER) {
      return
    }
    if (overlayShown || !this.dirty) {
      return
    }
    this.dirty = false
    this.renderSummary()
    this.renderGraph()
  }

  renderGraph() {
    const $graph = this.$graph
    $graph.innerHTML = ""
    this.generateGraph($graph, this.height, this.width)
  }

  renderInfo(e: MouseEvent) {
    const bounds = this.$graph.getBoundingClientRect()
    const padLeft = 60
    const pos = e.clientX - bounds.left
    if (pos < padLeft || pos > this.width) {
      if (this.handle) {
        this.hideInfo()
      }
      return
    }
    const segment = (this.width - padLeft) / METHODS.length
    const idx = Math.floor((pos - padLeft) / segment)
    const method = METHODS[idx]
    if (this.handle) {
      clearTimeout(this.handle)
      this.handle = undefined
    }
    const box = this.data[method]
    if (typeof box === "undefined") {
      this.hideInfo()
      return
    }
    const $info = (
      <div class="info">
        <div class="pad-bottom">
          <strong>{METHOD_LABELS[method]}</strong>
        </div>
        <div>
          Maximum
          <div class={`right value-${this.key}`}>{decimal(box.max)}%</div>
        </div>
        <div>
          3<sup>rd</sup> Quartile
          <div class={`right value-${this.key}`}>{decimal(box.q3)}%</div>
        </div>
        <div>
          Median
          <div class={`right value-${this.key}`}>{decimal(box.median)}%</div>
        </div>
        <div>
          1<sup>st</sup> Quartile
          <div class={`right value-${this.key}`}>{decimal(box.q1)}%</div>
        </div>
        <div>
          Minimum
          <div class={`right value-${this.key}`}>{decimal(box.min)}%</div>
        </div>
      </div>
    )
    this.$info.replaceWith($info)
    this.$info = $info
    show(this.$info)
    this.handle = setTimeout(() => this.hideInfo(), 2400)
  }

  renderSummary() {
    const $summary = <div class="summary"></div>
    const data = []
    for (let i = 0; i < METHODS.length; i++) {
      const method = METHODS[i]
      const box = this.data[method]
      if (typeof box === "undefined") {
        continue
      }
      data.push({label: METHOD_LABELS[method], value: box.median})
    }
    if (data.length === 0) {
      $summary.appendChild(<div>Calculating ...</div>)
    } else {
      if (this.sort === SORT_ASCENDING) {
        data.sort((a, b) => a.value - b.value)
      } else if (this.sort === SORT_DESCENDING) {
        data.sort((a, b) => b.value - a.value)
      }
      for (let i = 0; i < data.length; i++) {
        const info = data[i]
        $summary.appendChild(
          <div class="pad-bottom">
            {info.label}
            <div class={`right value-${this.key}`}>{decimal(info.value)}%</div>
          </div>
        )
      }
    }
    this.$summary.replaceWith($summary)
    this.$summary = $summary
  }

  reset() {
    this.data = {}
    this.dirty = true
    this.max = 0
  }

  setDimensions() {
    if (!IN_BROWSER) {
      return
    }
    let width = this.$root.offsetWidth - this.$summary.offsetWidth
    if (width < 200) {
      width = 200
    }
    if (width === this.width) {
      return
    }
    this.$graph.setAttribute("height", `${this.height}`)
    this.$graph.setAttribute("width", `${width}`)
    this.$graph.setAttribute("viewBox", `0 0 ${width} ${this.height}`)
    this.width = width
    this.markDirty()
  }

  setupUI() {
    const $downloadPNG = (
      <div class="action">
        <img src="download.svg" alt="Download" />
        <span>Download PNG</span>
      </div>
    )
    $downloadPNG.addEventListener("click", () => this.downloadGraph("png"))
    const $downloadSVG = (
      <div class="action">
        <img src="svg.svg" alt="svg" />
        <span>Download SVG</span>
      </div>
    )
    $downloadSVG.addEventListener("click", () => this.downloadGraph("svg"))
    const $graph = document.createElementNS(SVG, "svg")
    $graph.addEventListener("mousemove", (e: MouseEvent) => this.renderInfo(e))
    $graph.addEventListener("mouseout", () => this.hideInfo())
    $graph.setAttribute("preserveAspectRatio", "none")
    $graph.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`)
    const $info = <div class="info"></div>
    const $summary = <div class="summary"></div>
    const $content = (
      <div class="content">
        <div class="graph-holder">
          {$info}
          {$summary}
          <div class="graph">{$graph}</div>
        </div>
        <div class="clear"></div>
      </div>
    )
    const $root = (
      <div class="simulation">
        <div class="heading">Range of % {this.label}</div>
        {$downloadSVG}
        {$downloadPNG}
        <div class="clear"></div>
        {$content}
      </div>
    )
    this.$graph = $graph
    this.$info = $info
    this.$root = $root
    this.$summary = $summary
    return $root
  }

  update(method: number, info?: BoxPlot) {
    this.dirty = true
    if (info) {
      if (info.max > this.max) {
        this.max = info.max
      }
      this.data[method] = info
    } else {
      delete this.data[method]
    }
  }
}

class ConfigValidator {
  cfg: Record<string, any>
  seen: Set<string>

  constructor(cfg: Config) {
    this.cfg = cfg
    this.seen = new Set()
  }

  checkFields() {
    const fields = Object.keys(this.cfg)
    const seen = this.seen
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]
      if (!seen.has(field)) {
        throw `Config has field "${field}" which hasn't been validated`
      }
    }
  }

  validate(fields: string[], validator: (field: string, val: any) => void) {
    fields.forEach((field) => {
      this.seen.add(field)
      const val = this.cfg[field]
      if (val === undefined) {
        throw `The value for "${field}" cannot be undefined`
      }
      validator(field, val)
    })
  }

  validateBoolean(fields: string[]) {
    this.validate(fields, (field, val) => {
      if (typeof val !== "boolean") {
        throw `The value for "${field}" must be a boolean`
      }
    })
  }

  validateDistribution(fields: string[]) {
    this.validate(fields, (field, val) => {
      if (!val.sample) {
        throw `The value for "${field}" must be a Distribution`
      }
    })
  }

  validateNumber(min: number, fields: string[]) {
    this.validate(fields, (field, val) => {
      if (typeof val !== "number") {
        throw `The value for "${field}" must be a number`
      }
      if (Math.floor(val) !== val) {
        throw `The value for "${field}" must be a whole number`
      }
      if (val < min) {
        throw `The value for "${field}" must be greater than ${min}`
      }
    })
  }

  validatePercentage(fields: string[]) {
    this.validate(fields, (field, val) => {
      if (typeof val !== "number") {
        throw `The value for "${field}" must be a number`
      }
      if (val < 0 || val > 1) {
        throw `The value for "${field}" must be between 0 and 1`
      }
    })
  }

  validateScore(fields: string[]) {
    this.validate(fields, (field, val) => {
      if (typeof val !== "number") {
        throw `The value for "${field}" must be a number`
      }
      if (Math.floor(val) !== val) {
        throw `The value for "${field}" must be a whole number`
      }
      if (val < 0 || val > 100) {
        throw `The value for "${field}" must be between 0 and 100`
      }
    })
  }

  validateString(fields: string[]) {
    this.validate(fields, (field, val) => {
      if (typeof val !== "string") {
        throw `The value for "${field}" must be a string`
      }
    })
  }

  validateStringValue(field: string, values: string[]) {
    this.seen.add(field)
    const val = this.cfg[field]
    if (val === undefined) {
      throw `The value for "${field}" cannot be undefined`
    }
    if (!includes(values, val)) {
      throw `Invalid value for "${field}"`
    }
  }
}

class Controller {
  barchart: BarChart
  cfg: Config
  cmps: Comparison[]
  definition: string
  handle: number
  paused: boolean
  rand: number
  schedule?: ReturnType<typeof setTimeout>
  sims: Record<number, Simulation>
  simList: Simulation[]
  threads: number
  workers: number
  $main: HTMLElement

  constructor() {
    this.cfg = defaultConfig()
    this.cmps = []
    this.definition = defaultConfigDefinition()
    this.rand = 1594657305122
    this.paused = false
    this.simList = []
    this.sims = {}
    this.threads = getCPUs()
    this.workers = 0
  }

  createWorkers() {
    for (let i = 0; i < this.simList.length; i++) {
      this.simList[i].createWorker()
    }
  }

  freeWorker() {
    this.workers--
    if (!this.schedule) {
      this.schedule = setTimeout(() => {
        this.schedule = undefined
        this.createWorkers()
      }, 0)
    }
  }

  init(methods: number[], setupUI: boolean) {
    for (let i = 0; i < methods.length; i++) {
      const method = methods[i]
      const sim = new Simulation(this, method)
      if (setupUI) {
        this.$main.appendChild(sim.setupUI())
      }
      this.simList.push(sim)
      this.sims[method] = sim
    }
    const barchart = new BarChart(this)
    const healthy = new Comparison(this, "healthy", "Healthy", SORT_DESCENDING)
    const isolated = new Comparison(
      this,
      "isolated",
      "Isolated",
      SORT_ASCENDING
    )
    if (setupUI) {
      this.$main.appendChild(barchart.setupUI())
      this.$main.appendChild(healthy.setupUI())
      this.$main.appendChild(isolated.setupUI())
    }
    this.barchart = barchart
    this.cmps.push(healthy)
    this.cmps.push(isolated)
  }

  initBrowser() {
    this.$main = $("main")
    this.init(METHODS, true)
    this.setDimensions()
    this.run()
    this.redraw()
  }

  initNodeJS(method: number) {
    this.init([method], false)
    this.run()
  }

  pause() {
    this.paused = true
  }

  randomise() {
    this.rand = Date.now()
    console.log(`Using random seed: ${this.rand}`)
    this.run()
  }

  redraw() {
    if (!this.paused) {
      for (let i = 0; i < this.simList.length; i++) {
        this.simList[i].render()
      }
      for (let i = 0; i < this.cmps.length; i++) {
        this.cmps[i].render()
      }
    }
    this.barchart.render()
    this.handle = 0
  }

  requestRedraw() {
    if (!IN_BROWSER) {
      return
    }
    if (this.handle) {
      return
    }
    this.handle = requestAnimationFrame(() => this.redraw())
  }

  resetComparison() {
    this.barchart.reset()
    for (let i = 0; i < this.cmps.length; i++) {
      this.cmps[i].reset()
    }
    this.requestRedraw()
  }

  resume() {
    this.paused = false
    this.requestRedraw()
  }

  run() {
    this.resetComparison()
    for (let i = 0; i < this.simList.length; i++) {
      const sim = this.simList[i]
      if (!sim.hidden) {
        sim.run(this.cfg, this.definition, this.rand)
      }
    }
  }

  runNew(cfg: Config, definition: string) {
    this.cfg = cfg
    this.definition = definition
    this.rand = Date.now()
    this.run()
  }

  setDimensions() {
    if (!IN_BROWSER) {
      return
    }
    for (let i = 0; i < this.simList.length; i++) {
      this.simList[i].setDimensions()
    }
    for (let i = 0; i < this.cmps.length; i++) {
      this.cmps[i].setDimensions()
    }
    this.barchart.setDimensions()
  }

  updateComparison(method: number, info?: SummaryBoxPlot) {
    if (info) {
      for (let i = 0; i < this.cmps.length; i++) {
        const cmp = this.cmps[i]
        cmp.update(method, info[cmp.key])
      }
    } else {
      for (let i = 0; i < this.cmps.length; i++) {
        this.cmps[i].update(method)
      }
    }
    this.barchart.update(method, info)
    this.requestRedraw()
  }

  workersAvailable() {
    if (this.workers < this.threads) {
      this.workers++
      return true
    }
    return false
  }
}

class Model {
  cfg: Config
  clusters: Cluster[]
  computed: Computed
  day: number
  households: number[][]
  id: number
  installBase: number
  isolatedPeriods: number
  lockdown: boolean
  lockdownEase: number
  method: number
  people: Person[]
  period: number
  present: number[][]
  privateClusters: number[]
  publicClusters: number[]
  rand: number
  recentInfections: number[][]
  results: Stats[]
  rng: RNGGroup
  spread: number[][]
  testQueue: number[]

  createRNG() {
    const rand = this.rand
    return {
      additionalCluster: new RNG(`additionalCluster-${rand}`),
      appInstalled: new RNG(`appInstalled-${rand}`),
      clusterCount: new RNG(`clusterCount-${rand}`),
      clusterSize: new RNG(`clusterSize-${rand}`),
      exposedVisit: new RNG(`exposedVisit-${rand}`),
      fatality: new RNG(`fatality-${rand}`),
      foreign: new RNG(`foreign-${rand}`),
      groupSize: new RNG(`groupSize-${rand}`),
      household: new RNG(`household-${rand}`),
      illness: new RNG(`illness-${rand}`),
      immunity: new RNG(`immunity-${rand}`),
      infect: new RNG(`infect-${rand}`),
      init: new RNG(`init-${rand}`),
      installForeign: new RNG(`installForeign-${rand}`),
      installOwn: new RNG(`installOwn-${rand}`),
      isolationEffectiveness: new RNG(`isolationEffectiveness-${rand}`),
      isolationLikelihood: new RNG(`isolationLikelihood-${rand}`),
      isolationLockdown: new RNG(`isolationLockdown-${rand}`),
      isolationSymptomatic: new RNG(`isolationSymptomatic-${rand}`),
      keyWorker: new RNG(`keyWorker-${rand}`),
      publicClusters: new RNG(`publicClusters-${rand}`),
      selectOwnCluster: new RNG(`selectOwnCluster-${rand}`),
      selectPrivateCluster: new RNG(`selectPrivateCluster-${rand}`),
      selectPublicCluster: new RNG(`selectPublicCluster-${rand}`),
      selfAttestation: new RNG(`selfAttestation-${rand}`),
      shuffle: new RNG(`shuffle-${rand}`),
      shuffleGroup: new RNG(`shuffleGroup-${rand}`),
      symptomatic: new RNG(`symptomatic-${rand}`),
      testDelay: new RNG(`testDelay-${rand}`),
      testKeyWorker: new RNG(`testKeyWorker-${rand}`),
      testNotified: new RNG(`testNotified-${rand}`),
      testSymptomatic: new RNG(`testSymptomatic-${rand}`),
      vaccinated: new RNG(`symptomatic-${rand}`),
      visitForeignCluster: new RNG(`visitForeignCluster-${rand}`),
      visitPublicCluster: new RNG(`visitPublicCluster-${rand}`),
    }
  }

  handleMessage(req: WorkerRequest) {
    this.cfg = eval(`(${req.definition})`)
    this.method = req.method
    this.rand = req.rand
    this.init()
    this.run()
  }

  init() {
    console.log(`>> Running ${getMethodID(this.method)}`)
    const cfg = this.cfg
    const immunityEnd = cfg.days + 1
    const rng = this.createRNG()
    // Generate people with custom attributes.
    const people: Person[] = []
    let appInstalled = 0
    if (this.method === METHOD_APPLE_GOOGLE) {
      appInstalled = cfg.appleGoogleInstalled
    } else if (this.method === METHOD_SAFETYSCORE) {
      appInstalled = cfg.safetyScoreInstalled
    }
    let installBase = 0
    let personID = 0
    for (let i = 0; i < cfg.population; i++) {
      let attrs = 0
      if (rng.appInstalled.next() <= appInstalled) {
        attrs |= PERSON_APP_INSTALLED
        installBase++
      }
      if (rng.keyWorker.next() <= cfg.keyWorkers) {
        attrs |= PERSON_KEY_WORKER
      }
      if (rng.symptomatic.next() <= cfg.symptomatic) {
        attrs |= PERSON_SYMPTOMATIC
      }
      const person = new Person(attrs, personID++, this)
      if (rng.vaccinated.next() <= cfg.vaccinated) {
        person.immunityEndDay = immunityEnd
        person.status |= STATUS_IMMUNE
      }
      people.push(person)
    }
    this.people = people
    this.rng = rng
    // Generate households and allocate people to households.
    const households: number[][] = []
    let i = 0
    let houseID = 0
    while (i < cfg.population) {
      const members: number[] = []
      const size = cfg.household.sample(rng.household)
      for (let j = 0; j < size; j++) {
        members.push(i++)
        if (i === cfg.population) {
          break
        }
      }
      for (let j = 0; j < members.length; j++) {
        const selfID = members[j]
        const self = people[selfID]
        const contacts = []
        for (let x = 0; x < members.length; x++) {
          const otherID = members[x]
          if (otherID === selfID) {
            continue
          }
          contacts.push(otherID)
        }
        self.household = houseID
        self.householdContacts = contacts
      }
      households.push(members)
      houseID++
    }
    this.households = households
    // Generate clusters and allocate a primary cluster for everyone.
    const clusters: Cluster[] = []
    const present: number[][] = []
    const privateClusters: number[] = []
    const publicClusters: number[] = []
    let clusterID = 0
    let clusterPeople = people.slice(0)
    shuffle(clusterPeople, rng.shuffle)
    i = 0
    while (i < cfg.population) {
      const members: number[] = []
      const size = cfg.clusterSize.sample(rng.clusterSize)
      for (let j = 0; j < size; j++) {
        const person = clusterPeople[i++]
        members.push(person.id)
        person.clusters.push(clusterID)
        if (i === cfg.population) {
          break
        }
      }
      let attrs = 0
      if (rng.publicClusters.next() <= cfg.publicClusters) {
        attrs |= CLUSTER_PUBLIC
        publicClusters.push(clusterID)
      } else {
        privateClusters.push(clusterID)
      }
      const cluster: Cluster = {
        attrs,
        members,
      }
      clusterID++
      clusters.push(cluster)
      present.push([])
    }
    this.clusters = clusters
    this.present = present
    this.privateClusters = privateClusters
    this.publicClusters = publicClusters
    // Assign additional clusters for some people.
    const totalClusters = clusters.length
    for (i = 0; i < cfg.population; i++) {
      const person = people[i]
      const size = cfg.clusterCount.sample(rng.clusterCount)
      if (size > 1) {
        for (let j = 1; j < size && j < totalClusters; j++) {
          let id = Math.floor(rng.additionalCluster.next() * clusters.length)
          while (includes(person.clusters, id)) {
            id = Math.floor(rng.additionalCluster.next() * clusters.length)
          }
          clusters[id].members.push(person.id)
          person.clusters.push(id)
        }
      }
    }
    // Make certain clusters safeguarded and install SafetyScore to all members.
    if (this.method === METHOD_SAFETYSCORE) {
      let converted = 0
      const convert = new Set()
      const limit = Math.round(cfg.safeguardedClusters * cfg.population)
      const safeguarded = clusters.slice(0)
      shuffle(safeguarded, rng.shuffle)
      for (i = 0; i < safeguarded.length; i++) {
        if (converted >= limit) {
          break
        }
        const cluster = safeguarded[i]
        cluster.attrs |= CLUSTER_SAFEGUARDED
        for (let j = 0; j < cluster.members.length; j++) {
          const id = cluster.members[j]
          const member = people[id]
          if (!convert.has(id)) {
            converted++
            convert.add(id)
            if (
              rng.installOwn.next() <= cfg.installOwn &&
              member.installSafetyScore(0)
            ) {
              installBase++
            }
          }
        }
      }
      if (cfg.installHousehold) {
        for (i = 0; i < cfg.population; i++) {
          const person = people[i]
          if (!person.appInstalled()) {
            continue
          }
          for (let j = 0; j < person.householdContacts.length; j++) {
            const id = person.householdContacts[j]
            if (id > i) {
              if (people[id].installSafetyScore(0)) {
                installBase++
              }
            }
          }
        }
      }
    } else if (this.method === METHOD_APPLE_GOOGLE && cfg.installHousehold) {
      for (i = 0; i < cfg.population; i++) {
        const person = people[i]
        if (!person.appInstalled()) {
          continue
        }
        for (let j = 0; j < person.householdContacts.length; j++) {
          const id = person.householdContacts[j]
          if (id > i) {
            const other = people[id]
            if (!other.appInstalled()) {
              other.attrs |= PERSON_APP_INSTALLED
              installBase++
            }
          }
        }
      }
    }
    this.installBase = installBase / cfg.population
    // Derive computed values from config parameters.
    let traceDays = 0
    if (this.method === METHOD_APPLE_GOOGLE) {
      traceDays = 14
    } else if (this.method === METHOD_SAFETYSCORE) {
      traceDays =
        cfg.preInfectiousDays +
        cfg.preSymptomaticInfectiousDays +
        Math.round(getMean(cfg.illness)) +
        1
    }
    this.computed = {
      dailyForeign: cfg.foreignImports / cfg.population,
      dailyTests: Math.round(cfg.dailyTestCapacity * cfg.population),
      inactivityPenalty: 100 / traceDays,
      infectiousDays:
        cfg.preSymptomaticInfectiousDays + Math.round(getMean(cfg.illness)),
      installForeign: cfg.installForeign / cfg.days,
      traceDays,
    }
    // Initialise other properties.
    this.day = 0
    this.isolatedPeriods = 0
    this.lockdown = false
    this.lockdownEase = 0
    this.period = 0
    this.recentInfections = []
    this.results = []
    this.spread = []
    this.testQueue = []
  }

  nextDay() {
    this.day++
    const cfg = this.cfg
    const computed = this.computed
    const day = this.day
    const infectionRisk = cfg.infectionRisk
    const isolationEnd = day + cfg.isolationDays
    const people = this.people
    const rng = this.rng
    let infected = 0
    let spreadBy = 0
    let spreadTotal = 0
    for (let i = 0; i < cfg.population; i++) {
      const person = people[i]
      // Update the status of infected people.
      if (person.infected()) {
        infected++
        if (day === person.infectedDay + cfg.preInfectiousDays) {
          // Handle the day the person might become symptomatic.
          person.status |= STATUS_CONTAGIOUS
          if (person.symptomatic()) {
            if (rng.isolationSymptomatic.next() <= cfg.isolationSymptomatic) {
              person.isolate(isolationEnd)
            }
            if (
              person.testDay === 0 &&
              rng.testSymptomatic.next() <= cfg.testSymptomatic
            ) {
              person.testDay = day + cfg.testDelay.sample(rng.testDelay)
            }
            if (
              this.method === METHOD_SAFETYSCORE &&
              person.appInstalled() &&
              rng.selfAttestation.next() <= cfg.selfAttestation
            ) {
              person.deposit(-1, 0, people, 3)
            }
            if (cfg.isolateHousehold) {
              for (let j = 0; j < person.householdContacts.length; j++) {
                people[person.householdContacts[j]].isolate(isolationEnd)
              }
            }
          }
        } else if (day === person.infectionEndDay) {
          spreadBy++
          spreadTotal += person.spread
          // Handle the end of the infection.
          if (rng.fatality.next() <= cfg.fatalityRisk) {
            person.status = STATUS_DEAD
          } else {
            person.status &= ~STATUS_CONTAGIOUS
            person.status &= ~STATUS_INFECTED
            person.status |= STATUS_IMMUNE | STATUS_RECOVERED
          }
        }
        // If the person is contagious, try and infect any healthy members of
        // their household.
        if ((person.status & STATUS_CONTAGIOUS) !== 0) {
          for (let j = 0; j < person.householdContacts.length; j++) {
            const other = people[person.householdContacts[j]]
            if (
              (other.status & STATUS_INFECTED) === 0 &&
              (other.status & STATUS_IMMUNE) === 0
            ) {
              if (rng.infect.next() <= infectionRisk) {
                other.infect(day, person.gen + 1)
                person.spread++
                break
              }
            }
          }
        }
      } else if (rng.foreign.next() <= computed.dailyForeign) {
        // Infect a person from a foreign imported case.
        person.infect(day, 0)
      }
      if (person.status === STATUS_DEAD) {
        continue
      }
      // If the person wants to be tested, then add them to the test queue.
      if (day === person.testDay) {
        person.testDay = -1
        this.testQueue.push(person.id)
      }
      // Strip the individual of immunity once it ends.
      if (
        (person.status & STATUS_IMMUNE) !== 0 &&
        day === person.immunityEndDay
      ) {
        person.status &= ~STATUS_IMMUNE
      }
      // Remove the individual from isolation once it ends.
      if (
        (person.status & STATUS_ISOLATED) !== 0 &&
        day === person.isolationEndDay
      ) {
        person.isolationEndDay = 0
        person.status &= ~STATUS_ISOLATED
      }
      // If the individual was prompted to consider the app, see if they'll
      // install it.
      if ((person.attrs & PERSON_APP_FOREIGN_CLUSTER) !== 0) {
        if (rng.installForeign.next() <= computed.installForeign) {
          person.attrs &= ~PERSON_APP_FOREIGN_CLUSTER
          person.installSafetyScore(day)
        }
      }
    }
    if (this.recentInfections.length === computed.infectiousDays) {
      const first = this.recentInfections.shift() as number[]
      first[0] = spreadTotal
      first[1] = spreadBy
      this.recentInfections.push(first)
    } else {
      this.recentInfections.push([spreadTotal, spreadBy])
    }
    const queue = this.testQueue
    if (this.method === METHOD_APPLE_GOOGLE) {
      // Follow the Apple/Google Exposure Notification method where contacts of
      // infected individuals are notified.
      const seen = new Set()
      for (let i = 0; i < computed.dailyTests && queue.length > 0; i++) {
        const id = queue.shift() as number
        const person = people[id]
        if (person.status === STATUS_DEAD) {
          continue
        }
        if (person.infected()) {
          // Place infected individuals into isolation.
          person.isolate(isolationEnd)
          if (cfg.isolateHousehold) {
            for (let j = 0; j < person.householdContacts.length; j++) {
              people[person.householdContacts[j]].isolate(isolationEnd)
            }
          }
          // Notify their contacts.
          if (person.appInstalled()) {
            for (let j = 0; j < person.contacts.length; j++) {
              const contacts = person.contacts[j]
              for (let k = 0; k < contacts.length; k++) {
                const id = contacts[k]
                if (seen.has(id)) {
                  continue
                }
                const contact = people[id]
                // Prompt the contact to get tested.
                if (
                  contact.testDay === 0 &&
                  rng.testNotified.next() <= cfg.testNotified
                ) {
                  contact.testDay = day + cfg.testDelay.sample(rng.testDelay)
                }
                // Prompt the contact to self-isolate.
                if (rng.isolationLikelihood.next() <= cfg.isolationLikelihood) {
                  contact.isolate(isolationEnd)
                }
                seen.add(id)
              }
            }
          }
        } else if ((person.status & STATUS_ISOLATED) !== 0) {
          // If an individual had been notified and isolated, remove them from
          // isolation.
          person.isolationEndDay = 0
          person.status &= ~STATUS_ISOLATED
        }
        person.testDay = 0
      }
      // Remove old contacts and re-use cleared Array for upcoming contacts.
      for (let i = 0; i < cfg.population; i++) {
        const person = people[i]
        if (person.status !== STATUS_DEAD && person.appInstalled()) {
          if (person.contacts.length === computed.traceDays) {
            const first = person.contacts.shift() as number[]
            first.length = 0
            person.contacts.push(first)
          } else {
            person.contacts.push([])
          }
        }
      }
    } else if (this.method === METHOD_SAFETYSCORE) {
      const {inactivityPenalty, traceDays} = computed
      // Handle test results.
      for (let i = 0; i < computed.dailyTests && queue.length > 0; i++) {
        const id = queue.shift() as number
        const person = people[id]
        if (person.status === STATUS_DEAD) {
          continue
        }
        if (person.infected()) {
          person.isolate(isolationEnd)
          if (cfg.isolateHousehold) {
            for (let j = 0; j < person.householdContacts.length; j++) {
              people[person.householdContacts[j]].isolate(isolationEnd)
            }
          }
          if (person.appInstalled()) {
            person.deposit(-1, 0, people, 0)
          }
        } else {
          person.tokens.length = 0
          person.tokens.push([0, 0, 0, 0, 0, 0])
          if ((person.status & STATUS_ISOLATED) !== 0) {
            person.isolationEndDay = 0
            person.status &= ~STATUS_ISOLATED
          }
        }
        person.testDay = 0
      }
      // Amplify second-degree weighting based on app penetration and test
      // capacity.
      const contactLikelihood = this.installBase * this.installBase
      const secondDegree =
        cfg.secondDegreeWeight *
        Math.min(
          10 / (contactLikelihood * contactLikelihood * cfg.dailyTestCapacity),
          50
        )
      for (let i = 0; i < cfg.population; i++) {
        const person = people[i]
        if (person.status === STATUS_DEAD || !person.appInstalled()) {
          continue
        }
        // Update the SafetyScore of everyone who has the app installed.
        let score = 100
        let selfAttestations = 0
        for (let j = 0; j < person.tokens.length; j++) {
          const account = person.tokens[j]
          score -= account[0] * 100
          score -= account[1] * 50
          score -= account[2] * secondDegree
          selfAttestations += account[3] * 100
          selfAttestations += account[4] * 50
          selfAttestations += account[5] * secondDegree
        }
        // Only consider self-attestations if there are deposits that were
        // triggered by an official test.
        if (score < 100) {
          score -= selfAttestations
        }
        const active = Math.max(0, day - person.installDate)
        if (active < traceDays) {
          score -= (traceDays - active) * inactivityPenalty
        }
        person.score = score
        let recentFirst = false
        if (person.tokens.length > 0) {
          recentFirst = person.tokens[person.tokens.length - 1][1] > 0
        }
        // Prompt the individual to isolate and get tested if they received a
        // recent first-degree deposit triggered by an official test.
        if (recentFirst && score <= cfg.isolationThreshold) {
          if (rng.isolationLikelihood.next() <= cfg.isolationLikelihood) {
            person.isolate(isolationEnd)
          }
          if (
            person.testDay === 0 &&
            rng.testNotified.next() <= cfg.testNotified
          ) {
            person.testDay = day + cfg.testDelay.sample(rng.testDelay)
          }
        }
        // Remove old contacts.
        if (person.contacts.length === computed.traceDays) {
          const first = person.contacts.shift() as number[]
          first.length = 0
          person.contacts.push(first)
        } else {
          person.contacts.push([])
        }
        // Remove old daily accounts.
        if (person.tokens.length === computed.traceDays) {
          const first = person.tokens.shift() as number[]
          first[0] = 0
          first[1] = 0
          first[2] = 0
          first[3] = 0
          first[4] = 0
          first[5] = 0
          person.tokens.push(first)
        } else {
          person.tokens.push([0, 0, 0, 0, 0, 0])
        }
      }
    } else {
      for (let i = 0; i < computed.dailyTests && queue.length > 0; i++) {
        const id = queue.shift() as number
        const person = people[id]
        if (person.status === STATUS_DEAD) {
          continue
        }
        if (person.infected()) {
          person.isolate(isolationEnd)
          if (cfg.isolateHousehold) {
            for (let j = 0; j < person.householdContacts.length; j++) {
              people[person.householdContacts[j]].isolate(isolationEnd)
            }
          }
        }
      }
      if (this.method === METHOD_LOCKDOWN) {
        if (this.lockdown) {
          if (infected < cfg.lockdownEnd) {
            this.lockdownEase++
            if (this.lockdownEase === cfg.lockdownEndWindow) {
              this.lockdown = false
            }
          } else {
            this.lockdownEase = 0
          }
        } else if (infected >= cfg.lockdownStart) {
          this.lockdown = true
        }
      }
      if (this.lockdown && cfg.testKeyWorkers) {
        // Test key workers.
        for (let i = 0; i < cfg.population; i++) {
          const person = people[i]
          if (
            (person.attrs & PERSON_KEY_WORKER) !== 0 &&
            person.testDay === 0 &&
            rng.testKeyWorker.next() <= cfg.testKeyWorker
          ) {
            person.testDay = day + cfg.testDelay.sample(rng.testDelay)
          }
        }
      }
    }
    // Generate the daily stats.
    const lockdown = this.lockdown
    const stats: Stats = {
      dead: 0,
      healthy: 0,
      immune: 0,
      infected: 0,
      installed: 0,
      isolated: 0,
      isolatedPeriods: this.isolatedPeriods / CLUSTER_PERIODS,
      lockdown,
      r: 0,
      recovered: 0,
      uhealthy: 0,
    }
    for (let i = 0; i < cfg.population; i++) {
      const person = people[i]
      const status = person.status
      if ((status & STATUS_HEALTHY) !== 0) {
        stats.healthy++
      } else if ((status & STATUS_INFECTED) !== 0) {
        stats.infected++
      } else if ((status & STATUS_RECOVERED) !== 0) {
        stats.recovered++
      } else if ((status & STATUS_DEAD) !== 0) {
        stats.dead++
      }
      if ((status & STATUS_IMMUNE) !== 0) {
        stats.immune++
      }
      if (lockdown) {
        if ((person.attrs & PERSON_KEY_WORKER) === 0) {
          stats.isolated++
        } else if ((status & STATUS_ISOLATED) !== 0) {
          stats.isolated++
        }
      } else {
        if ((status & STATUS_ISOLATED) !== 0) {
          stats.isolated++
        }
      }
      if ((person.attrs & PERSON_APP_INSTALLED) !== 0) {
        stats.installed++
        if ((status & STATUS_HEALTHY) !== 0) {
          stats.uhealthy++
        }
      }
    }
    spreadTotal = 0
    spreadBy = 0
    for (let i = 0; i < this.recentInfections.length; i++) {
      const stat = this.recentInfections[i]
      spreadTotal += stat[0]
      spreadBy += stat[1]
    }
    if (spreadBy) {
      stats.r = spreadTotal / spreadBy
    }
    this.installBase = stats.installed / cfg.population
    this.isolatedPeriods = 0
    this.results.push(stats)
    return stats
  }

  nextPeriod() {
    this.period++
    if (this.period === CLUSTER_PERIODS) {
      this.period = 0
    }
    const cfg = this.cfg
    const clusters = this.clusters
    const lockdown = this.lockdown
    const method = this.method
    const people = this.people
    const rng = this.rng
    const present = this.present
    let isolatedPeriods = 0
    for (let i = 0; i < cfg.population; i++) {
      const person = people[i]
      // Skip dead people.
      if (person.status === STATUS_DEAD) {
        continue
      }
      if (lockdown) {
        // If they're not a key worker, see if they might temporarily break
        // isolation for some reason.
        if ((person.attrs & PERSON_KEY_WORKER) === 0) {
          if (rng.isolationLockdown.next() <= cfg.isolationLockdown) {
            isolatedPeriods++
            continue
          }
        } else if ((person.status & STATUS_ISOLATED) !== 0) {
          if (rng.isolationLockdown.next() <= cfg.isolationLockdown) {
            isolatedPeriods++
            continue
          }
        }
      } else {
        // If the person is self-isolating, only consider them if they temporarily
        // break isolation for some reason.
        if ((person.status & STATUS_ISOLATED) !== 0) {
          if (rng.isolationEffectiveness.next() <= cfg.isolationEffectiveness) {
            isolatedPeriods++
            continue
          }
        }
      }
      // Select a cluster for the person to visit.
      let clusterID
      if (rng.visitForeignCluster.next() <= cfg.visitForeignCluster) {
        if (rng.visitPublicCluster.next() <= cfg.visitPublicCluster) {
          clusterID = Math.floor(
            rng.selectPublicCluster.next() * this.publicClusters.length
          )
        } else {
          clusterID = Math.floor(
            rng.selectPrivateCluster.next() * this.privateClusters.length
          )
        }
      } else {
        clusterID = Math.floor(
          rng.selectOwnCluster.next() * person.clusters.length
        )
      }
      if (method === METHOD_SAFETYSCORE) {
        const cluster = clusters[clusterID]
        if ((cluster.attrs & CLUSTER_SAFEGUARDED) === 0) {
          // If the person has SafetyScore and the cluster isn't safeguarded,
          // see if they'll consider visiting it. We don't consider this an
          // isolated period as it's a free choice by the individual.
          if ((person.attrs & PERSON_APP_INSTALLED) !== 0) {
            if (!(rng.exposedVisit.next() <= cfg.exposedVisit)) {
              continue
            }
          }
        } else {
          // For a safeguarded cluster, if the user doesn't have the app
          // installed, see if they will consider installing it.
          if ((person.attrs & PERSON_APP_INSTALLED) === 0) {
            person.attrs |= PERSON_APP_FOREIGN_CLUSTER
            continue
          }
          // If they do have the app, check if their score meets the necessary
          // level.
          if (person.score <= cfg.safeguardThreshold) {
            continue
          }
        }
      }
      present[clusterID].push(person.id)
    }
    const contagious = []
    const day = this.day
    const group = []
    const healthy = []
    const infectionRisk = cfg.infectionRisk
    const installed = []
    const trace =
      this.method === METHOD_APPLE_GOOGLE || this.method === METHOD_SAFETYSCORE
    for (let i = 0; i < present.length; i++) {
      const visitors = present[i]
      while (visitors.length > 0) {
        // Segment the visitors into groups.
        let size = cfg.groupSize.sample(rng.groupSize)
        contagious.length = 0
        group.length = 0
        healthy.length = 0
        installed.length = 0
        while (size > 0 && visitors.length > 0) {
          group.push(visitors.pop())
          size--
        }
        shuffle(group, rng.shuffleGroup)
        // Identify the healthy/recovered, the infected, and those with apps.
        for (let j = 0; j < group.length; j++) {
          const person = people[group[j]!]
          if ((person.status & STATUS_CONTAGIOUS) !== 0) {
            contagious.push(person)
          } else if (
            (person.status & STATUS_INFECTED) === 0 &&
            (person.status & STATUS_IMMUNE) === 0
          ) {
            healthy.push(person)
          }
          if (trace && (person.attrs & PERSON_APP_INSTALLED) !== 0) {
            installed.push(person)
          }
        }
        // If any are contagious, try and infect the healthy.
        if (contagious.length > 0 && healthy.length > 0) {
          for (let j = 0; j < healthy.length; j++) {
            for (let k = 0; k < contagious.length; k++) {
              if (rng.infect.next() <= infectionRisk) {
                const from = contagious[k]
                healthy[j].infect(day, from.gen + 1)
                from.spread++
                break
              }
            }
          }
        }
        // Establish contacts between those who have app installed.
        if (trace) {
          for (let j = 0; j < installed.length; j++) {
            const contacts = installed[j].contacts
            const cur = contacts[contacts.length - 1]
            for (let k = 0; k < installed.length; k++) {
              if (j === k) {
                continue
              }
              cur.push(installed[k].id)
            }
          }
        }
      }
    }
    this.isolatedPeriods += isolatedPeriods
  }

  run() {
    for (let i = 0; i < this.cfg.days; i++) {
      if (this.period === 0) {
        const stats = this.nextDay()
        sendMessage({rand: this.rand, stats})
      }
      for (let j = 0; j < CLUSTER_PERIODS; j++) {
        this.nextPeriod()
      }
    }
  }
}

class NormalDistribution {
  max: number
  min: number

  constructor({mean, min}: {mean: number; min: number}) {
    this.max = 2 * mean
    this.min = min || 0
  }

  rand(rng: RNG) {
    let u1 = 0
    let u2 = 0
    while (u1 === 0) {
      u1 = rng.next()
    }
    while (u2 === 0) {
      u2 = rng.next()
    }
    let sample = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
    sample = Math.round((sample / 10 + 0.5) * this.max)
    return sample
  }

  sample(rng: RNG) {
    while (true) {
      const val = this.rand(rng)
      if (val >= this.min && val <= this.max) {
        return val
      }
    }
  }
}

// Person encapsulates an individual within the simulation.
class Person {
  attrs: number
  clusters: number[]
  contacts: number[][]
  gen: number
  household: number
  householdContacts: number[]
  id: number
  immunityEndDay: number
  infectedDay: number
  infectionEndDay: number
  installDate: number
  isolationEndDay: number
  model: Model
  score: number
  spread: number
  status: number
  testDay: number
  tokens: number[][]

  constructor(attrs: number, id: number, model: Model) {
    this.attrs = attrs
    this.clusters = []
    this.contacts = []
    this.gen = -1
    this.id = id
    this.infectedDay = 0
    this.infectionEndDay = 0
    this.immunityEndDay = 0
    this.installDate = 0
    this.isolationEndDay = 0
    this.model = model
    this.score = 0
    this.spread = 0
    this.status = STATUS_HEALTHY
    this.testDay = 0
    this.tokens = []
  }

  appInstalled() {
    return (this.attrs & PERSON_APP_INSTALLED) !== 0
  }

  // NOTE(tav): We simplify the calculations and deposit the tokens in just the
  // current daily account.
  deposit(from: number, depth: number, people: Person[], offset: number) {
    if (this.status === STATUS_DEAD) {
      return
    }
    this.tokens[this.tokens.length - 1][offset + depth] += 1
    if (depth === 2) {
      return
    }
    depth++
    for (let i = 0; i < this.contacts.length; i++) {
      const contacts = this.contacts[i]
      for (let j = 0; j < contacts.length; j++) {
        const id = contacts[j]
        if (id === from) {
          continue
        }
        people[id].deposit(this.id, depth, people, offset)
      }
    }
  }

  infect(today: number, gen: number) {
    if ((this.status & STATUS_INFECTED) !== 0) {
      return false
    }
    if ((this.status & STATUS_IMMUNE) !== 0) {
      return false
    }
    if (this.status === STATUS_DEAD) {
      return false
    }
    const model = this.model
    this.gen = gen
    this.infectedDay = today
    this.infectionEndDay =
      model.day +
      model.cfg.preInfectiousDays +
      model.cfg.preSymptomaticInfectiousDays +
      model.cfg.illness.sample(model.rng.illness)
    this.immunityEndDay =
      this.infectionEndDay + model.cfg.immunity.sample(model.rng.immunity)
    this.spread = 0
    this.status &= ~STATUS_HEALTHY
    this.status &= ~STATUS_RECOVERED
    this.status |= STATUS_INFECTED
    return true
  }

  infected() {
    return (this.status & STATUS_INFECTED) !== 0
  }

  installSafetyScore(day: number) {
    if (this.appInstalled()) {
      return false
    }
    this.attrs |= PERSON_APP_INSTALLED
    this.installDate = day
    this.tokens.push([0, 0, 0, 0, 0, 0])
    return true
  }

  isolate(end: number) {
    if (this.status === STATUS_DEAD) {
      return
    }
    this.isolationEndDay = end
    this.status |= STATUS_ISOLATED
  }

  symptomatic() {
    return (this.attrs & PERSON_SYMPTOMATIC) !== 0
  }
}

// Derived from:
// https://stackoverflow.com/questions/1241555/algorithm-to-generate-poisson-and-binomial-random-numbers
class PoissonDistribution {
  limit: number
  max: number
  min: number

  constructor({max, mean, min}: {max: number; mean: number; min: number}) {
    this.limit = Math.exp(-mean)
    this.max = max
    this.min = min
  }

  rand(rng: RNG) {
    let k = 1
    let p = rng.next()
    while (p > this.limit) {
      k++
      p *= rng.next()
    }
    return k - 1
  }

  sample(rng: RNG) {
    while (true) {
      const val = this.rand(rng)
      if (val >= this.min && val <= this.max) {
        return val
      }
    }
  }
}

// RNG provides a seedable random number generator.
//
// Copyright (c) 2010, Johannes Baagøe <baagoe@baagoe.org>
// MIT License
//
// https://web.archive.org/web/20120124013936/http://baagoe.org/en/wiki/Better_random_numbers_for_javascript
class RNG {
  c: number
  s0: number
  s1: number
  s2: number

  constructor(seed: string) {
    let n = 0xefc8249d
    const mash = (data: string) => {
      for (let i = 0; i < data.length; i++) {
        n += data.charCodeAt(i)
        let h = 0.02519603282416938 * n
        n = h >>> 0
        h -= n
        h *= n
        n = h >>> 0
        h -= n
        n += h * 0x100000000 // 2^32
      }
      return (n >>> 0) * 2.3283064365386963e-10 // 2^-32
    }
    this.c = 1
    this.s0 = mash(" ")
    this.s1 = mash(" ")
    this.s2 = mash(" ")
    this.s0 -= mash(seed)
    if (this.s0 < 0) {
      this.s0 += 1
    }
    this.s1 -= mash(seed)
    if (this.s1 < 0) {
      this.s1 += 1
    }
    this.s2 -= mash(seed)
    if (this.s2 < 0) {
      this.s2 += 1
    }
  }

  next() {
    const t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10 // 2^-32
    this.s0 = this.s1
    this.s1 = this.s2
    return (this.s2 = t - (this.c = t | 0))
  }
}

class Simulation {
  cfg: Config
  ctrl: Controller
  definition: string
  dirty: boolean
  downloadHidden: boolean
  handle?: ReturnType<typeof setTimeout>
  handleToggle: (e: Event) => void
  heading: string
  height: number
  hidden: boolean
  id: number
  method: number
  progress: number
  rand: number
  results: Stats[]
  runs: Stats[][]
  runsFinished: boolean
  runsUpdate: boolean
  selected: number
  summaries: Summary[]
  summariesShown: boolean
  variance: number
  width: number
  worker?: AbstractedWorker
  workerNeeded: boolean
  $content: HTMLElement
  $download: HTMLElement
  $info: HTMLElement
  $graph: SVGElement
  $heading: HTMLElement
  $root: HTMLElement
  $run: HTMLElement
  $settings: HTMLElement
  $status: HTMLElement
  $summaries: HTMLElement
  $summariesLink: HTMLElement
  $summary: HTMLElement
  $tbody: HTMLElement
  $visibilityImage: HTMLElement
  $visibilitySpan: HTMLElement

  constructor(ctrl: Controller, method: number) {
    this.ctrl = ctrl
    this.dirty = true
    this.downloadHidden = true
    this.heading = getMethodLabel(method)
    this.height = 300
    this.hidden = false
    this.method = method
    this.results = []
    this.runs = []
    this.runsFinished = false
    this.runsUpdate = false
    this.selected = -1
    this.summaries = []
    this.summariesShown = false
    this.variance = 0
    this.width = 0
    this.workerNeeded = false
  }

  computeBoxPlots() {
    const dead = []
    const healthy = []
    const infected = []
    const isolated = []
    for (let i = 0; i < this.summaries.length; i++) {
      const summary = this.summaries[i]
      dead.push(summary.dead)
      healthy.push(summary.healthy)
      infected.push(summary.infected)
      isolated.push(summary.isolated)
    }
    return {
      dead: computeBoxPlot(dead),
      healthy: computeBoxPlot(healthy),
      infected: computeBoxPlot(infected),
      isolated: computeBoxPlot(isolated),
    }
  }

  computeVariance() {
    const runs = this.summaries.length
    const values = []
    let sum = 0
    for (let i = 0; i < runs; i++) {
      const val = this.summaries[i].healthy
      values.push(val)
      sum += val
    }
    const mean = sum / runs
    sum = 0
    for (let i = 0; i < runs; i++) {
      const diff = values[i] - mean
      sum += diff * diff
    }
    return sum / runs
  }

  createWorker() {
    if (this.workerNeeded && this.ctrl.workersAvailable()) {
      this.workerNeeded = false
      this.worker = new AbstractedWorker("./simulation.js")
      this.worker.onMessage((msg: WorkerResponse) => this.handleMessage(msg))
      this.worker.postMessage({
        definition: this.definition,
        method: this.method,
        rand: this.rand,
      })
    }
  }

  downloadCSV(idx: number) {
    const lines = []
    const results = this.runs[idx]
    lines.push(
      "Day,Healthy,Infected,Recovered,Immune,Dead,Isolated,App Installed"
    )
    for (let i = 0; i < results.length; i++) {
      const stats = results[i]
      lines.push(
        `${i + 1},${stats.healthy},${stats.infected},${stats.recovered},${
          stats.immune
        },${stats.dead},${stats.isolated},${stats.installed}`
      )
    }
    const blob = new Blob([lines.join("\n")], {type: "text/csv;charset=utf-8"})
    const filename = this.getFilename("csv")
    triggerDownload(blob, filename)
  }

  downloadGraph(format: string, selected?: number) {
    const filename = this.getFilename(format)
    const height = 1500
    const legend = 300
    const width = 2400
    const graph = document.createElementNS(SVG, "svg")
    graph.setAttribute("height", "100%")
    graph.setAttribute("viewBox", `0 0 ${width} ${height + legend}`)
    graph.setAttribute("width", "100%")
    let results = this.results
    if (typeof selected !== "undefined") {
      results = this.runs[selected]
    } else if (this.selected !== -1) {
      results = this.runs[this.selected]
    }
    this.generateGraph(graph, results, height, width)
    // Compute values for drawing the legend.
    const bottomline = height + 210
    const fifth = width / 5
    const font = this.cfg.imageFont
    const fontSize = "60px"
    const fontWeight = "500"
    const midline = height + 75
    const summary = getSummary(results)
    const topline = height + 130
    const textpad = 120
    let posX = 70
    // Draw blank area at bottom of the canvas for the legend.
    addNode(graph, "rect", {
      fill: "#fff",
      height: legend,
      width: width,
      x: 0,
      y: height,
    })
    // Draw the legend for healthy.
    addNode(graph, "rect", {
      fill: COLOUR_HEALTHY,
      height: 100,
      width: 100,
      x: posX,
      y: midline,
    })
    addNode(graph, "text", {
      "font-family": font,
      "font-size": fontSize,
      "font-weight": fontWeight,
      x: posX + textpad,
      y: topline,
    }).innerHTML = "Healthy"
    addNode(graph, "text", {
      "font-family": font,
      "font-size": fontSize,
      "font-weight": fontWeight,
      x: posX + textpad,
      y: bottomline,
    }).innerHTML = `${percent(summary.healthy)}`
    // Draw the legend for infected.
    posX += fifth
    addNode(graph, "rect", {
      fill: COLOUR_INFECTED,
      height: 100,
      width: 100,
      x: posX,
      y: midline,
    })
    addNode(graph, "text", {
      "font-family": font,
      "font-size": fontSize,
      "font-weight": fontWeight,
      x: posX + textpad,
      y: topline,
    }).innerHTML = "Infected"
    addNode(graph, "text", {
      "font-family": font,
      "font-size": fontSize,
      "font-weight": fontWeight,
      x: posX + textpad,
      y: bottomline,
    }).innerHTML = `${percent(summary.infected)}`
    // Draw the legend for recovered.
    posX += fifth
    addNode(graph, "rect", {
      fill: COLOUR_RECOVERED,
      height: 100,
      width: 100,
      x: posX,
      y: midline,
    })
    addNode(graph, "text", {
      "font-family": font,
      "font-size": fontSize,
      "font-weight": fontWeight,
      x: posX + textpad,
      y: topline,
    }).innerHTML = "Recovered"
    // Draw the legend for dead.
    posX += fifth
    addNode(graph, "rect", {
      fill: COLOUR_DEAD,
      height: 100,
      width: 100,
      x: posX,
      y: midline,
    })
    addNode(graph, "text", {
      "font-family": font,
      "font-size": fontSize,
      "font-weight": fontWeight,
      x: posX + textpad,
      y: topline,
    }).innerHTML = "Dead"
    addNode(graph, "text", {
      "font-family": font,
      "font-size": fontSize,
      "font-weight": fontWeight,
      x: posX + textpad,
      y: bottomline,
    }).innerHTML = `${percent(summary.dead)}`
    // Draw the legend for isolated.
    posX += fifth
    addNode(graph, "rect", {
      fill: "#eeeeee",
      height: 100,
      width: 100,
      x: posX,
      y: midline,
    })
    addNode(graph, "text", {
      "font-family": font,
      "font-size": fontSize,
      "font-weight": fontWeight,
      x: posX + textpad,
      y: topline,
    }).innerHTML = "Isolated"
    addNode(graph, "text", {
      "font-family": font,
      "font-size": fontSize,
      "font-weight": fontWeight,
      x: posX + textpad,
      y: bottomline,
    }).innerHTML = `${percent(summary.isolated)}`
    // Generate the SVG and convert into a downloadable image.
    const svg = new XMLSerializer().serializeToString(graph)
    downloadImage({filename, format, height: height + legend, svg, width})
  }

  generateGraph(
    $graph: SVGElement,
    results: Stats[],
    height?: number,
    width?: number
  ) {
    let unitX = 1
    let unitY = 1
    if (height) {
      unitY = height / this.cfg.population
    } else {
      height = this.cfg.population
    }
    if (width) {
      unitX = width / this.cfg.days
    } else {
      width = this.cfg.days
    }
    addNode($graph, "rect", {
      fill: "#eeeeee",
      height: height,
      width: width,
      x: 0,
      y: 0,
    })
    const days = results.length
    if (days === 0) {
      return
    }
    const healthy = []
    const infected = []
    const recovered = []
    for (let i = 0; i < days; i++) {
      const stats = results[i]
      const posX = i * unitX
      let posY = stats.dead * unitY
      recovered.push(`${posX},${posY}`)
      posY += stats.recovered * unitY
      healthy.push(`${posX},${posY}`)
      posY += stats.healthy * unitY
      infected.push(`${posX},${posY}`)
    }
    const endX = days * unitX
    const last = results[days - 1]
    let posY = last.dead * unitY
    recovered.push(`${endX},${posY}`)
    recovered.push(`${endX},${height}`)
    recovered.push(`0,${height}`)
    posY += last.recovered * unitY
    healthy.push(`${endX},${posY}`)
    healthy.push(`${endX},${height}`)
    healthy.push(`0,${height}`)
    posY += last.healthy * unitY
    infected.push(`${endX},${posY}`)
    infected.push(`${endX},${height}`)
    infected.push(`0,${height}`)
    addNode($graph, "rect", {
      fill: COLOUR_DEAD,
      height: height,
      width: endX,
      x: 0,
      y: 0,
    })
    addNode($graph, "polyline", {
      fill: COLOUR_RECOVERED,
      points: recovered.join(" "),
    })
    addNode($graph, "polyline", {
      fill: COLOUR_HEALTHY,
      points: healthy.join(" "),
    })
    addNode($graph, "polyline", {
      fill: COLOUR_INFECTED,
      points: infected.join(" "),
    })
  }

  getFilename(ext: string) {
    return `simulation-${getMethodID(this.method)}-${Date.now()}.${ext}`
  }

  getResults() {
    if (this.selected === -1) {
      return this.results
    }
    return this.runs[this.selected]
  }

  handleMessage(resp: WorkerResponse) {
    if (this.rand !== resp.rand) {
      return
    }
    this.markDirty()
    this.results.push(resp.stats)
    if (this.results.length === this.cfg.days) {
      const summary = getSummary(this.results, this.summaries.length, this.rand)
      this.runs.push(this.results)
      this.runsUpdate = true
      this.summaries.push(summary)
      this.summaries.sort((a, b) => b.healthy - a.healthy)
      this.ctrl.updateComparison(this.method, this.computeBoxPlots())
      const runs = this.summaries.length
      if (runs === this.cfg.runsMax) {
        this.runsFinished = true
      } else if (runs >= this.cfg.runsMin) {
        const variance = this.computeVariance()
        if (this.variance !== 0) {
          const diff = Math.abs(variance - this.variance) / 100
          if (diff < this.cfg.runsVariance) {
            this.runsFinished = true
          }
        }
        this.variance = variance
      } else {
        this.variance = this.computeVariance()
      }
      if (this.runsFinished) {
        if (this.selected === -1) {
          this.selected = this.summaries[
            Math.floor(this.summaries.length / 2)
          ].idx
        }
        this.killWorker()
      } else {
        this.rand++
        this.results = []
        this.worker!.postMessage({
          definition: this.definition,
          method: this.method,
          rand: this.rand,
        })
      }
    }
  }

  hide() {
    if (this.hidden) {
      return
    }
    this.killWorker()
    this.downloadHidden = true
    this.hidden = true
    this.$heading.style.paddingTop = "11px"
    hide(this.$content)
    hide(this.$download)
    hide(this.$run)
    hide(this.$settings)
    const $visibilityImage = <img src="show.svg" alt="Show" />
    this.$visibilityImage.replaceWith($visibilityImage)
    this.$visibilityImage = $visibilityImage
    const $visibilitySpan = <span>Show/Restart Simulation</span>
    this.$visibilitySpan.replaceWith($visibilitySpan)
    this.$visibilitySpan = $visibilitySpan
    this.$root.addEventListener("click", this.handleToggle)
    this.$root.classList.toggle("clickable")
    this.ctrl.setDimensions()
  }

  hideInfo() {
    if (this.handle) {
      clearTimeout(this.handle)
      this.handle = undefined
    }
    hide(this.$info)
  }

  hideSummaries() {
    if (!this.summariesShown) {
      return
    }
    this.runsUpdate = true
    this.summariesShown = false
    this.$summariesLink.innerHTML = "Show All"
    hide(this.$summaries)
    this.markDirty()
  }

  killWorker() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = undefined
      this.ctrl.freeWorker()
    }
    this.workerNeeded = false
  }

  markDirty() {
    this.dirty = true
    this.ctrl.requestRedraw()
  }

  randomise() {
    const rand = Date.now()
    console.log(`Using random seed: ${rand}`)
    this.ctrl.updateComparison(this.method)
    this.run(this.cfg, this.definition, rand)
  }

  render() {
    if (!IN_BROWSER) {
      return
    }
    if (this.hidden || overlayShown || !this.dirty) {
      return
    }
    const results = this.getResults()
    this.dirty = false
    this.renderSummary(results)
    this.renderGraph(results)
    this.renderRuns()
  }

  renderGraph(results: Stats[]) {
    if (!IN_BROWSER) {
      return
    }
    if (results.length === this.cfg.days && this.downloadHidden) {
      this.downloadHidden = false
      show(this.$download)
    }
    const $graph = this.$graph
    $graph.innerHTML = ""
    this.generateGraph($graph, results)
  }

  renderInfo(e: MouseEvent) {
    const bounds = this.$graph.getBoundingClientRect()
    const pos = e.clientX - bounds.left
    if (pos < 0 || pos > this.width) {
      if (this.handle) {
        this.hideInfo()
      }
      return
    }
    const results = this.getResults()
    const width = this.width / this.cfg.days
    const day = Math.floor(pos / width)
    if (day >= results.length) {
      if (this.handle) {
        this.hideInfo()
      }
      return
    }
    if (this.handle) {
      clearTimeout(this.handle)
    }
    const stats = results[day]
    let $users = <div></div>
    if (
      this.method === METHOD_APPLE_GOOGLE ||
      this.method === METHOD_SAFETYSCORE
    ) {
      $users = (
        <div>
          App Users<div class="right value">{stats.installed}</div>
        </div>
      )
    }
    const $info = (
      <div class="info">
        <div>
          Day<div class="right">{day + 1}</div>
        </div>
        <div>
          Dead<div class="right value-dead">{stats.dead}</div>
        </div>
        <div>
          Recovered<div class="right value-recovered">{stats.recovered}</div>
        </div>
        <div>
          Healthy<div class="right value-healthy">{stats.healthy}</div>
        </div>
        <div>
          Infected<div class="right value-infected">{stats.infected}</div>
        </div>
        <div>
          Isolated<div class="right value">{stats.isolated}</div>
        </div>
        {$users}
      </div>
    )
    this.$info.replaceWith($info)
    this.$info = $info
    show(this.$info)
    this.handle = setTimeout(() => this.hideInfo(), 1200)
  }

  renderRuns() {
    if (!this.runsUpdate) {
      return
    }
    this.runsUpdate = false
    const runs = this.runs.length
    let linkedStatus = false
    let status = ""
    if (!this.runsFinished) {
      if (!(this.cfg.runsMin === 1 && this.cfg.runsMax === 1)) {
        status = `Running #${this.runs.length + 1}`
        if (this.summariesShown && this.selected !== -1) {
          linkedStatus = true
        }
      }
    }
    if (linkedStatus) {
      this.$status.innerHTML = ""
      this.$status.appendChild(
        <a
          href=""
          onclick={(e: Event) => {
            e.preventDefault()
            if (this.selected !== -1) {
              this.selected = -1
            }
            this.hideSummaries()
          }}>
          {status}
        </a>
      )
    } else {
      this.$status.innerHTML = status
    }
    if (runs === 0) {
      if (!this.summariesShown) {
        hide(this.$summariesLink)
      }
    } else {
      show(this.$summariesLink)
    }
    const $tbody = <tbody></tbody>
    for (let i = 0; i < this.summaries.length; i++) {
      const summary = this.summaries[i]
      const idx = summary.idx
      let view
      if (this.selected === idx) {
        view = <td>View #{idx + 1}</td>
      } else {
        view = (
          <td>
            <a
              href={`#${summary.rand}`}
              title={`Run ${idx + 1} of ${this.runs.length}`}
              onclick={(e: Event) => {
                e.preventDefault()
                this.selected = idx
                this.runsUpdate = true
                this.markDirty()
              }}>
              View #{idx + 1}
            </a>
          </td>
        )
      }
      $tbody.appendChild(
        <tr>
          {view}
          <td class="value-healthy">{decimal(summary.healthy)}%</td>
          <td class="value-infected">{decimal(summary.infected)}%</td>
          <td class="value-dead">{decimal(summary.dead)}%</td>
          <td>{decimal(summary.isolated)}%</td>
          <td class="downloads">
            <a
              href=""
              onclick={(e: Event) => {
                e.preventDefault()
                this.downloadCSV(idx)
              }}>
              csv
            </a>{" "}
            ·{" "}
            <a
              href=""
              onclick={(e: Event) => {
                e.preventDefault()
                this.downloadGraph("png", idx)
              }}>
              png
            </a>{" "}
            ·{" "}
            <a
              href=""
              onclick={(e: Event) => {
                e.preventDefault()
                this.downloadGraph("svg", idx)
              }}>
              svg
            </a>
          </td>
        </tr>
      )
    }
    this.$tbody.replaceWith($tbody)
    this.$tbody = $tbody
  }

  renderSummary(results: Stats[]) {
    if (!IN_BROWSER) {
      return
    }
    if (results.length === 0) {
      return
    }
    const summary = getSummary(results)
    const $summary = (
      <div class="summary">
        <div>
          Days<div class="right">{summary.days}</div>
        </div>
        <div>
          Isolated<div class="right value">{percent(summary.isolated)}</div>
        </div>
        <div>
          Healthy
          <div class="right value-healthy">{percent(summary.healthy)}</div>
        </div>
        <div>
          Infected
          <div class="right value-infected">{percent(summary.infected)}</div>
        </div>
        <div>
          Dead<div class="right value-dead">{percent(summary.dead)}</div>
        </div>
      </div>
    )
    this.$summary.replaceWith($summary)
    this.$summary = $summary
  }

  run(cfg: Config, definition: string, rand: number) {
    this.killWorker()
    if (IN_BROWSER) {
      this.$graph.setAttribute("viewBox", `0 0 ${cfg.days} ${cfg.population}`)
      this.$summary.innerHTML = "&nbsp;"
    }
    if (this.hidden) {
      this.hidden = false
      show(this.$root)
    }
    this.cfg = cfg
    this.definition = definition
    this.downloadHidden = true
    this.rand = rand
    this.results = []
    this.runs = []
    this.runsFinished = false
    this.runsUpdate = true
    this.selected = -1
    this.summaries = []
    this.variance = 0
    this.workerNeeded = true
    this.markDirty()
    hide(this.$download)
    this.createWorker()
  }

  setDimensions() {
    if (!IN_BROWSER) {
      return
    }
    if (this.hidden) {
      return
    }
    let width = this.$root.offsetWidth - this.$summary.offsetWidth
    if (width < 200) {
      width = 200
    }
    if (width === this.width) {
      return
    }
    this.$graph.setAttribute("height", `${this.height}`)
    this.$graph.setAttribute("width", `${width}`)
    this.runsUpdate = true
    this.width = width
    this.markDirty()
  }

  setupUI() {
    this.handleToggle = (e: Event) => this.toggle(e)
    const $download = (
      <div class="action">
        <img src="download.svg" alt="Download" />
        <span>Download PNG</span>
      </div>
    )
    $download.addEventListener("click", () => this.downloadGraph("png"))
    hide($download)
    const $graph = document.createElementNS(SVG, "svg")
    $graph.addEventListener("mousemove", (e: MouseEvent) => this.renderInfo(e))
    $graph.addEventListener("mouseout", () => this.hideInfo())
    $graph.setAttribute("preserveAspectRatio", "none")
    $graph.setAttribute("viewBox", "0 0 0 0")
    const $heading = <div class="heading">{this.heading}</div>
    const $info = <div class="info"></div>
    const $run = (
      <div class="action">
        <img class="refresh" src="refresh.svg" alt="Refresh" />
        <span>Run New Simulation</span>
      </div>
    )
    $run.addEventListener("click", () => this.randomise())
    const $settings = (
      <div class="action">
        <img src="settings.svg" alt="Settings" />
        <span>Edit Config</span>
      </div>
    )
    $settings.addEventListener("click", displayConfig)
    const $summariesLink = <a href="">See All</a>
    $summariesLink.addEventListener("click", (e: Event) =>
      this.toggleSummaries(e)
    )
    hide($summariesLink)
    const $status = <div class="status"></div>
    const $statusHolder = (
      <div class="status-holder">
        {$status}
        <div class="right value">{$summariesLink}</div>
      </div>
    )
    const $summary = <div class="summary"></div>
    const $tbody = <tbody></tbody>
    const $summaries = (
      <div class="summaries">
        <table>
          <thead>
            <tr>
              <th>Run</th>
              <th>
                Healthy
                <img class="down" src="down.svg" alt="Down Arrow" />
              </th>
              <th>Infected</th>
              <th>Dead</th>
              <th>Isolated</th>
              <th>Download</th>
            </tr>
          </thead>
          {$tbody}
        </table>
      </div>
    )
    hide($summaries)
    const $visibilityImage = <img src="hide.svg" alt="Hide" />
    const $visibilitySpan = <span>Hide/Stop Simulation</span>
    const $visibility = (
      <div class="action">
        {$visibilityImage}
        {$visibilitySpan}
      </div>
    )
    $visibility.addEventListener("click", this.handleToggle)
    const $content = (
      <div class="content">
        <div class="graph-holder">
          {$info}
          {$summary}
          <div class="graph">{$graph}</div>
          {$statusHolder}
        </div>
        <div class="clear"></div>
        {$summaries}
      </div>
    )
    const $root = (
      <div class="simulation">
        {$heading}
        {$visibility}
        {$settings}
        {$run}
        {$download}
        <div class="clear"></div>
        {$content}
      </div>
    )
    this.$content = $content
    this.$download = $download
    this.$graph = $graph
    this.$heading = $heading
    this.$info = $info
    this.$root = $root
    this.$run = $run
    this.$settings = $settings
    this.$status = $status
    this.$summaries = $summaries
    this.$summary = $summary
    this.$summariesLink = $summariesLink
    this.$tbody = $tbody
    this.$visibilityImage = $visibilityImage
    this.$visibilitySpan = $visibilitySpan
    return $root
  }

  show() {
    if (!this.hidden) {
      return
    }
    this.hidden = false
    this.$heading.style.paddingTop = "14px"
    show(this.$content)
    show(this.$run)
    show(this.$settings)
    const $visibilityImage = <img src="hide.svg" alt="Hide" />
    this.$visibilityImage.replaceWith($visibilityImage)
    this.$visibilityImage = $visibilityImage
    const $visibilitySpan = <span>Hide/Stop Simulation</span>
    this.$visibilitySpan.replaceWith($visibilitySpan)
    this.$visibilitySpan = $visibilitySpan
    this.$root.removeEventListener("click", this.handleToggle)
    this.$root.classList.toggle("clickable")
    const ctrl = this.ctrl
    ctrl.setDimensions()
    this.run(ctrl.cfg, ctrl.definition, ctrl.rand)
  }

  showSummaries() {
    this.runsUpdate = true
    this.summariesShown = true
    this.$summariesLink.innerHTML = "Hide All"
    show(this.$summaries)
    this.markDirty()
  }

  toggle(e: Event) {
    if (e) {
      e.stopPropagation()
    }
    if (this.hidden) {
      this.show()
    } else {
      this.hide()
    }
  }

  toggleSummaries(e?: Event) {
    if (e) {
      e.preventDefault()
    }
    if (this.summariesShown) {
      this.hideSummaries()
    } else {
      this.showSummaries()
    }
  }
}

// Derived from https://github.com/willscott/zipfian
class ZipfDistribution {
  eta: number
  items: number
  max: number
  min: number
  zetan: number

  constructor({max, min}: {max: number; min: number}) {
    this.items = max - min + 1
    this.max = max
    this.min = min
    this.zetan = getZeta(this.items, 0.99)
    this.eta =
      (1 - Math.pow(2 / this.items, 0.01)) / (1 - getZeta(2, 0.99) / this.zetan)
  }

  sample(rng: RNG) {
    const u = rng.next()
    const uz = u * this.zetan
    if (uz < 1) {
      return this.min
    }
    return (
      this.min +
      Math.floor(this.items * Math.pow(this.eta * u - this.eta + 1, 100))
    )
  }
}

function $(id: string) {
  return document.getElementById(id)!
}

function addNode(dst: SVGElement, typ: string, attrs: Record<string, any>) {
  const node = document.createElementNS(SVG, typ)
  if (attrs) {
    const keys = Object.keys(attrs)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      node.setAttribute(key, attrs[key])
    }
  }
  dst.appendChild(node)
  return node
}

// Derived from https://github.com/datavisyn/chartjs-chart-box-and-violin-plot
function computeBoxPlot(values: number[]) {
  values.sort((a, b) => a - b)
  const q1 = quantile(values, 0.25)
  const q3 = quantile(values, 0.75)
  const iqr = q3 - q1
  let max = values[values.length - 1]
  max = Math.min(max, q3 + 1.5 * iqr)
  let min = values[0]
  min = Math.max(min, q1 - 1.5 * iqr)
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v >= min) {
      min = v
      break
    }
  }
  if (min > q1) {
    min = q1
  }
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i]
    if (v <= max) {
      max = v
      break
    }
  }
  if (max < q3) {
    max = q3
  }
  return {
    max,
    median: quantile(values, 0.5),
    min,
    q1,
    q3,
    size: values.length,
  }
}

function decimal(v: number) {
  if (Math.floor(v) === v) {
    return v
  }
  return v.toFixed(2)
}

function defaultConfig(): Config {
  return {
    // the portion of people who have an Apple/Google-style Contact Tracing app installed
    appleGoogleInstalled: 0.6,
    // distribution of the number of clusters for a person
    clusterCount: new ZipfDistribution({min: 1, max: 20}),
    // distribution of the number of "primary" members in a cluster
    clusterSize: new PoissonDistribution({mean: 20, min: 1, max: 50}),
    // the portion of the population that can be tested
    dailyTestCapacity: 0.005,
    // number of days to run the simulation
    days: 400,
    // the likelihood of a SafetyScore user being okay with visiting a non-safeguarded cluster
    exposedVisit: 1 / 5,
    // likelihood of dying once infected
    fatalityRisk: 0.01,
    // daily likelihood of someone in the whole population getting infected from outside the population
    foreignImports: 0.06,
    // distribution of the group size within a cluster for a single period
    groupSize: new PoissonDistribution({mean: 2.5, min: 2, max: 20}),
    // distribution of the number of people in a household [not used yet]
    household: new PoissonDistribution({mean: 2.1, min: 1, max: 6}),
    // distribution of illness days after incubation
    illness: new NormalDistribution({mean: 10.5, min: 7}),
    // font to use on labels in generated images
    imageFont: "HelveticaNeue-Light, Arial",
    // distribution of the days of natural immunity
    immunity: new NormalDistribution({mean: 238, min: 0}),
    // likelihood of someone getting infected during a single contact
    infectionRisk: 0.01,
    // likelihood of someone installing SafetyScore for visiting a foreign safeguarded cluster
    installForeign: 0,
    // likelihood of someone installing SafetyScore if one of their own clusters becomes safeguarded
    installOwn: 1,
    // whether the app is installed for the whole household during initial installations
    installHousehold: false,
    // isolate whole household if someone self-isolates
    isolateHousehold: true,
    // number of days a person should self-isolate
    isolationDays: 21,
    // likelihood of a self-isolating person staying at home for any given period during the day
    isolationEffectiveness: 0.9,
    // likelihood of a notified person self-isolating
    isolationLikelihood: 0.9,
    // likelihood of an isolated person staying at home for any given period during lockdown
    isolationLockdown: 0.95,
    // the SafetyScore level below which one is notified to self-isolate and test
    isolationThreshold: 50,
    // likelihood of a symptomatic individual self-isolating
    isolationSymptomatic: 0.9,
    // portion of the population who will not be isolated during lockdown
    keyWorkers: 0.13,
    // the number of infected people, below which a lockdown could end
    lockdownEnd: 5,
    // number of days the number of infected people must be below "lockdownEnd" before lockdown ends
    lockdownEndWindow: 14,
    // the number of infected people which will trigger a lockdown
    lockdownStart: 6,
    // total number of people
    population: 10000,
    // number of days before becoming infectious
    preInfectiousDays: 3,
    // number of days of being infectious before possibly becoming symptomatic
    preSymptomaticInfectiousDays: 3,
    // portion of clusters which are public
    publicClusters: 0.16,
    // maximum number of runs to execute
    runsMax: 50,
    // minimum number of runs to execute
    runsMin: 10,
    // threshold of variance change at which to stop runs
    runsVariance: 0.0005,
    // the SafetyScore level needed to access a safeguarded cluster
    safeguardThreshold: 50,
    // the portion of clusters who safeguard access via SafetyScore
    safeguardedClusters: 0.6,
    // the portion of people who have SafetyScore installed at the start
    safetyScoreInstalled: 0,
    // a multiplicative weighting factor for second-degree tokens
    secondDegreeWeight: 1,
    // likelihood of a symptomatic person self-attesting
    selfAttestation: 0,
    // the portion of people who become symptomatic
    symptomatic: 1 / 3,
    // the distribution of the delay days between symptomatic/notified and testing
    testDelay: new PoissonDistribution({mean: 2, min: 1, max: 10}),
    // test all key workers
    testKeyWorkers: false,
    // likelihood of a key worker getting tested
    testKeyWorker: 1,
    // likelihood of a person getting themselves tested if notified
    testNotified: 0.9,
    // likelihood of a person getting themselves tested if symptomatic
    testSymptomatic: 0.6,
    // portion of people who have long-lasting immunity from vaccination
    vaccinated: 0,
    // likelihood of visiting a "foreign" cluster during a period
    visitForeignCluster: 0.2,
    // likelihood of visiting a public cluster when visiting a foreign cluster
    visitPublicCluster: 0.15,
  }
}

function defaultConfigDefinition() {
  let cfg = defaultConfig.toString()
  const start = cfg.indexOf("{", cfg.indexOf("{") + 1)
  const end = cfg.indexOf("};")
  cfg = cfg
    .slice(start, end)
    .trim()
    .split(",\n        //")
    .join(",\n\n    //")
    .split("        ")
    .join("    ")
  return cfg + "\n}"
}

function displayConfig() {
  if (overlayShown || !ctrl) {
    return
  }
  overlayShown = true
  ctrl.pause()
  if (!$config) {
    $config = $("config") as HTMLTextAreaElement
    $mirror = $("mirror") as HTMLPreElement
  }
  $config.value = ctrl.definition
  updateMirror(ctrl.definition)
  $("inlay").style.display = "flex"
  show($("overlay"))
  $config.focus()
  $config.scrollTop = 0
  $config.setSelectionRange(0, 0)
}

function downloadImage(img: {
  filename: string
  format: string
  height: number
  svg: string
  width: number
}) {
  if (img.format === "svg") {
    const blob = new Blob([img.svg], {type: "image/svg+xml"})
    triggerDownload(blob, img.filename)
  } else {
    downloadPNG(img.svg, img.filename, img.height, img.width)
  }
}

function downloadPNG(
  svg: string,
  filename: string,
  height: number,
  width: number
) {
  const blob = new Blob([svg], {type: "image/svg+xml"})
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  const img = new Image(width, height)
  const url = URL.createObjectURL(blob)
  canvas.height = height
  canvas.width = width
  img.onload = () => {
    URL.revokeObjectURL(url)
    ctx.drawImage(img, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) {
        triggerDownload(blob, filename)
      }
    })
  }
  img.src = url
}

function getCPUs() {
  if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
    const cpus = Math.max(1, Math.floor(navigator.hardwareConcurrency / 2))
    if (cpus > 2) {
      return cpus
    }
  }
  return 1
}

function getCmdBool(flag: string) {
  return process.argv.indexOf(flag) !== -1
}

function getCmdOpt(flag: string, fallback: string) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) {
    return fallback
  }
  return process.argv[idx + 1]
}

function getMean(dist: Distribution) {
  const rng = new RNG("mean")
  let val = 0
  for (let i = 0; i < 10000; i++) {
    val += dist.sample(rng)
  }
  return val / 10000
}

function getMethod(s: string) {
  let method
  switch (s) {
    case "apple-google":
      method = METHOD_APPLE_GOOGLE
      break
    case "lockdown":
      method = METHOD_LOCKDOWN
      break
    case "free-movement":
      method = METHOD_FREE_MOVEMENT
      break
    case "safetyscore":
      method = METHOD_SAFETYSCORE
      break
    default:
      throw `Unknown method: ${s}`
  }
  return method
}

function getMethodID(method: number) {
  if (method === METHOD_APPLE_GOOGLE) {
    return "apple-google"
  }
  if (method === METHOD_FREE_MOVEMENT) {
    return "free-movement"
  }
  if (method === METHOD_LOCKDOWN) {
    return "lockdown"
  }
  if (method === METHOD_SAFETYSCORE) {
    return "safetyscore"
  }
  throw `Unknown method: ${method}`
}

function getMethodLabel(method: number) {
  if (method === METHOD_APPLE_GOOGLE) {
    return "Apple/Google-Style Contact Tracing"
  }
  if (method === METHOD_FREE_MOVEMENT) {
    return "Free Movement"
  }
  if (method === METHOD_LOCKDOWN) {
    return "Lockdowns"
  }
  if (method === METHOD_SAFETYSCORE) {
    return "SafetyScore"
  }
  throw `Unknown method: ${method}`
}

function getSummary(results: Stats[], idx?: number, rand?: number) {
  const days = results.length
  const last = results[results.length - 1]
  const total = last.healthy + last.dead + last.recovered + last.infected
  const healthy = (last.healthy / total) * 100
  const infected = 100 - healthy
  const dead = (last.dead / total) * 100
  let isolated = 0
  for (let i = 0; i < results.length; i++) {
    isolated += results[i].isolated
  }
  isolated = (isolated / (days * total)) * 100
  return {
    days,
    dead,
    healthy,
    idx: idx || 0,
    infected,
    isolated,
    population: total,
    rand: rand || 0,
  }
}

function getZeta(n: number, theta: number) {
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += 1 / Math.pow(i + 1, theta)
  }
  return sum
}

function h(
  tag: string,
  props?: ElemProps,
  ...children: Array<string | HTMLElement>
) {
  const elem = document.createElement(tag)
  if (props) {
    const keys = Object.keys(props)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const val = (props as Record<string, any>)[key]
      if (key === "class") {
        elem.className = val
      } else if (key === "onclick") {
        elem.addEventListener("click", val)
      } else {
        elem.setAttribute(key, val)
      }
    }
  }
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (typeof child === "string" || typeof child === "number") {
      elem.appendChild(document.createTextNode(child))
    } else {
      elem.appendChild(child)
    }
  }
  return elem
}

function handleInlayClick(e: Event) {
  e.stopPropagation()
}

function handleKeyboard(e: KeyboardEvent) {
  if (overlayShown) {
    if (e.code === "Escape") {
      handleOverlayClick()
      return
    }
    if (e.ctrlKey && e.code === "Enter") {
      updateConfig()
      return
    }
    return
  }
  if (e.code === "KeyE") {
    displayConfig()
    return
  }
  if (e.code === "KeyR" && ctrl) {
    ctrl.randomise()
    return
  }
  if (e.code === "KeyX" && ctrl) {
    for (const sim of ctrl.simList) {
      sim.toggleSummaries()
    }
    return
  }
}

function handleOverlayClick(e?: Event) {
  if (e) {
    e.stopPropagation()
  }
  if (!overlayShown) {
    return
  }
  overlayShown = false
  $("error").style.display = "none"
  $("overlay").style.display = "none"
  if (ctrl) {
    ctrl.resume()
  }
}

function handleResize() {
  if (ctrl) {
    ctrl.setDimensions()
  }
}

function hide(elem: HTMLElement) {
  if (IN_BROWSER) {
    elem.style.display = "none"
  }
}

function includes<T>(array: Array<T>, value: T) {
  for (let i = 0; i < array.length; i++) {
    if (array[i] === value) {
      return true
    }
  }
  return false
}

function killWorkers() {
  if (!ctrl) {
    return
  }
  for (let i = 0; i < ctrl.simList.length; i++) {
    const sim = ctrl.simList[i]
    if (sim.worker) {
      sim.worker.terminate()
    }
  }
}

function percent(v: number) {
  if (v < 1 || v > 99) {
    const w = parseFloat((Math.round(v * 100) / 100).toFixed(1))
    if (w === 0) {
      if (v === 0) {
        return "0"
      }
      return "< 0.1%"
    }
    return `${w}%`
  }
  return `${Math.round(v)}%`
}

function printDistribution(dist: Distribution) {
  const bins: Record<string, number> = {}
  const rng = new RNG("dist")
  for (let i = 0; i < 100000; i++) {
    const val = dist.sample(rng)
    if (bins[val]) {
      bins[val] += 1
    } else {
      bins[val] = 1
    }
  }
  console.log("Value,Count")
  for (let i of Object.keys(bins)) {
    console.log(`${i},${bins[i]}`)
  }
}

function printUsage() {
  console.log(`Usage: simulation [OPTIONS]

  --config FILE    path to a config file
`)
}

// Derived from https://github.com/datavisyn/chartjs-chart-box-and-violin-plot
function quantile(values: number[], q: number) {
  const idx = q * (values.length - 1) + 1
  const lo = Math.floor(idx)
  const diff = idx - lo
  const a = values[lo - 1]
  if (diff === 0) {
    return a
  }
  return diff * (values[lo] - a) + a
}

function scrollEditor() {
  $mirror.scrollTop = $config.scrollTop
}

function sendMessage(resp: WorkerResponse) {
  if (IN_BROWSER) {
    postMessage(resp)
  } else if (parentPort) {
    parentPort.postMessage(resp)
  }
}

function show(elem: HTMLElement) {
  if (IN_BROWSER) {
    elem.style.display = "block"
  }
}

// Adapted from
// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array: Array<any>, rng: RNG) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
}

function syncEditor() {
  if (!overlayShown) {
    return
  }
  updateMirror($config.value)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.download = filename
  link.href = url
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 300000)
}

function trimpx(v: string) {
  if (!v.endsWith("px")) {
    throw new Error(`CSS unit value "${v}" does not end in "px"`)
  }
  return parseInt(v.slice(0, -2), 10)
}

function updateConfig(e?: Event) {
  if (e) {
    e.stopPropagation()
  }
  if (!overlayShown) {
    return
  }
  const $config = $("config") as HTMLTextAreaElement
  const definition = $config.value
  let cfg: Config
  try {
    cfg = validateConfig(eval(`(${definition})`))
  } catch (err) {
    const $error = $("error")
    $error.innerText = err.toString()
    $error.style.display = "block"
    return
  }
  overlayShown = false
  $("overlay").style.display = "none"
  ctrl.resume()
  ctrl.runNew(cfg, definition)
}

function updateMirror(src: string) {
  const code = Prism.highlight(src, Prism.languages.javascript)
  $mirror.innerHTML = code
}

function validateConfig(cfg: Config) {
  const v = new ConfigValidator(cfg)
  v.validateBoolean(["installHousehold", "isolateHousehold", "testKeyWorkers"])
  v.validateDistribution([
    "clusterCount",
    "clusterSize",
    "groupSize",
    "household",
    "illness",
    "immunity",
    "testDelay",
  ])
  v.validateNumber(0, [
    "lockdownEnd",
    "lockdownEndWindow",
    "preInfectiousDays",
    "preSymptomaticInfectiousDays",
  ])
  v.validateNumber(1, [
    "days",
    "isolationDays",
    "lockdownStart",
    "population",
    "runsMax",
    "runsMin",
  ])
  v.validatePercentage([
    "appleGoogleInstalled",
    "dailyTestCapacity",
    "exposedVisit",
    "fatalityRisk",
    "foreignImports",
    "infectionRisk",
    "installForeign",
    "installOwn",
    "isolationEffectiveness",
    "isolationLikelihood",
    "isolationLockdown",
    "isolationSymptomatic",
    "keyWorkers",
    "publicClusters",
    "runsVariance",
    "safeguardedClusters",
    "safetyScoreInstalled",
    "secondDegreeWeight",
    "selfAttestation",
    "symptomatic",
    "testKeyWorker",
    "testNotified",
    "testSymptomatic",
    "vaccinated",
    "visitForeignCluster",
    "visitPublicCluster",
  ])
  v.validateScore(["isolationThreshold", "safeguardThreshold"])
  v.validateString(["imageFont"])
  v.checkFields()
  return cfg
}

function runMulti(times: number, method: number) {
  const cfg = defaultConfig()
  const results = []
  for (let i = 0; i < times; i++) {
    const model = new Model()
    const rand = Date.now()
    console.log(`>> Running simulation #${i + 1}`)
    model.cfg = cfg
    model.method = method
    model.rand = rand
    model.init()
    model.run()
    results.push({
      healthy: model.results[model.results.length - 1].healthy,
      rand,
    })
  }
  results.sort((a, b) => a.healthy - b.healthy)
  for (const result of results) {
    console.log(result)
  }
}

function main() {
  if (IN_BROWSER) {
    if (IN_WORKER) {
      const model = new Model()
      self.onmessage = (e: MessageEvent) => model.handleMessage(e.data)
    } else {
      document.addEventListener("keyup", handleKeyboard)
      $("config").addEventListener("keyup", syncEditor)
      $("config").addEventListener("scroll", scrollEditor)
      $("inlay").addEventListener("click", handleInlayClick)
      $("overlay").addEventListener("click", handleOverlayClick)
      $("update-config").addEventListener("click", updateConfig)
      ctrl = new Controller()
      ctrl.initBrowser()
    }
  } else {
    const worker = require("worker_threads")
    const multi = getCmdOpt("--multi", "")
    if (multi) {
      if (process.argv.length === 2) {
        printUsage()
        process.exit()
      }
      const configFile = getCmdOpt("--config", "")
      if (configFile !== "") {
      }
      const method = getMethod(getCmdOpt("--method", "safetyscore"))
      runMulti(parseInt(multi, 10), method)
      return
    }
    if (worker.isMainThread) {
      const method = getMethod(getCmdOpt("--method", "safetyscore"))
      ctrl = new Controller()
      ctrl.initNodeJS(method)
    } else {
      const model = new Model()
      parentPort = worker.parentPort
      parentPort.on("message", (msg: WorkerRequest) => model.handleMessage(msg))
    }
  }
}

if (IN_BROWSER && !IN_WORKER) {
  window.addEventListener("beforeunload", killWorkers)
  window.addEventListener("load", main)
  window.addEventListener("resize", handleResize)
} else {
  main()
}
