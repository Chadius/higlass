import PixiTrack from './PixiTrack';

// Services
import { tileProxy } from './services';

// Utils
import { colorToHex } from './utils';

const GENE_RECT_WIDTH = 1;
const GENE_RECT_HEIGHT = 10;
const MAX_TEXTS = 20;

export class OverlayTrack extends PixiTrack {
  constructor(scene, options, animate) {
    super(scene, options);
    this.options = options || {};
    this.drawnRects = {};
  }

  draw() {
    super.draw();
    let graphics = this.pMain;
    const fill = colorToHex(this.options.fillColor ? this.options.fillColor : 'blue');

    graphics.clear();
    graphics.beginFill(fill, 0.3);

    for (let oAndP of this.options.orientationsAndPositions) {
      let orientation = oAndP.orientation;
      let position = oAndP.position;
      let xPos, yPos, width, height;
      
      if (['1d-horizontal', '2d'].includes(orientation)) {
        xPos = this.position[0] + position.left + 
          this._xScale(this.options.extent[0][0]);
         width = this._xScale(this.options.extent[0][1]) - 
          xPos + position.left + this.position[0];
      } else {        
         xPos = this.position[0] + position.left;
         width = position.width;
      }
      
      if (['1d-vertical', '2d'].includes(orientation)) {
         yPos = this.position[1] + position.top + 
          this._yScale(this.options.extent[0][0]);
         height = this._yScale(this.options.extent[0][1]) -
          yPos + position.top + this.position[1];
      } else {
         yPos = this.position[1] + position.top;
         height = position.height;
      }

      graphics.drawRect(xPos, yPos, width, height);
    }
  }

  zoomed(newXScale, newYScale) {
    this.xScale(newXScale);
    this.yScale(newYScale);

    this.draw();
  }

  setPosition(newPosition) {
    super.setPosition(newPosition);

    this.draw();
  }

  setDimensions(newDimensions) {
    super.setDimensions(newDimensions);

    this.draw();
  }

  exportSVG() {
    //TODO: implement me
  }
}

export default OverlayTrack;