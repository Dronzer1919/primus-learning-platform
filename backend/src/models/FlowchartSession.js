const mongoose = require('mongoose');

// Sub-schemas mirror FlowNode / FlowEdge in the Angular app
// (learning-platform/src/app/models/flowchart.model.ts). Declaring them rather
// than using Mixed is what keeps an arbitrary client payload out of the
// document: Mongoose casting drops every key that is not listed here, which is
// the same guarantee the playground controller gets from its allow-list.
//
// The string fields are deliberately not enum-constrained — there are 37 shape
// types, and keeping that list in sync across two languages would break the
// canvas the first time a shape is added on one side only.
const nodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    w: { type: Number, default: 0 },
    h: { type: Number, default: 0 },
    text: { type: String, default: '' },
    fill: String,
    stroke: String,
    fontFamily: String,
    fontSize: Number,
    bold: Boolean,
    italic: Boolean,
    underline: Boolean,
    strikethrough: Boolean,
    align: String,
    textColor: String,
    lineHeight: Number
  },
  { _id: false }
);

const edgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    bend: Number,
    routing: String,
    dash: String,
    endArrow: String,
    startArrow: String,
    color: String
  },
  { _id: false }
);

const flowchartSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    default: 'New Flowchart'
  },
  nodes: { type: [nodeSchema], default: [] },
  edges: { type: [edgeSchema], default: [] },
  canvasBg: {
    type: String,
    enum: ['plain', 'dots', 'grid'],
    default: 'dots'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

flowchartSessionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

flowchartSessionSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('FlowchartSession', flowchartSessionSchema);
