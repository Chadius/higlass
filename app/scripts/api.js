import ReactDOM from 'react-dom';

import {
  setDarkTheme, setTileProxyAuthHeader
} from './services';

import {
  MOUSE_TOOL_MOVE,
  MOUSE_TOOL_SELECT,
} from './configs';

import pubSub, { create } from './services/pub-sub';

let stack = {};
let pubSubs = [];

const apiPubSub = create(stack);

export const destroy = () => {
  pubSubs.forEach(subscription => pubSub.unsubscribe(subscription));
  pubSubs = [];
  stack = {};
};

const api = function api(context) {
  const self = context;

  // Public API
  return {
    setAuthHeader(newHeader) {
      setTileProxyAuthHeader(newHeader);

      // we need to re-request all the tiles
      this.reload();
    },

    /**
     * Reload all of the tiles
     */
    reload() {
      console.warn('Not implemented yet!');
    },

    destroy() {
      ReactDOM.unmountComponentAtNode(self.topDiv.parentNode);
    },

    getTrackObject(viewUid, trackUid) {
      return self.getTrackObject(viewUid, trackUid);
    },

    /**
     * Force integer range selections.
     *
     * @example
     *
     * hgv.activateTool('select'); // Activate select tool
     * hgv.setRangeSelectionToFloat(); // Allow float range selections
     */
    setRangeSelectionToInt() {
      self.setState({ rangeSelectionToInt: true });
    },


    /**
     * Force float range selections.
     *
     * @example
     *
     * hgv.activateTool('select'); // Activate select tool
     * hgv.setRangeSelectionToFloat(); // Allow float range selections
     */
    setRangeSelectionToFloat() {
      self.setState({ rangeSelectionToInt: false });
    },

    /**
     *
     *  The following enpoint restricts the size of range selection equally for 1D or
     *  2D tracks to a certain length (specified in absolute coordinates).
     *
     * @param {Number} [minSize = 0]  Minimum range selection. ``undefined`` unsets the value.
     * @param {Number} [maxSize = Infinity] Maximum range selection. ``undefined`` unsets the value.
     * @example
     *
     * hgv.activateTool('select'); // Activate select tool
     * hgv.setRangeSelection1dSize(5000, 10000); // Force selections to be between 5 and 10 Kb
     */
    setRangeSelection1dSize(minSize = 0, maxSize = Infinity) {
      self.setState({
        rangeSelection1dSize: [minSize, maxSize]
      });
    },

    /**
     * Set a new view config to define the layout and data
     * of this component
     *
     * @param {obj} newViewConfig A JSON object that defines
     *    the state of the HiGlassComponent
     * @example
     *
     * const p = hgv.setViewConfig(newViewConfig);
     * p.then(() => {
     *   // the initial set of tiles has been loaded
     * });
     *
     * @return {Promise} dataLoaded A promise that resolves when
     *   all of the data for this viewconfig is loaded
     */
    setViewConfig(newViewConfig) {
      const viewsByUid = self.processViewConfig(newViewConfig);
      const p = new Promise((resolve) => {
        this.requestsInFlight = 0;

        pubSubs.push(pubSub.subscribe('requestSent', () => {
          this.requestsInFlight += 1;
        }));

        pubSubs.push(pubSub.subscribe('requestReceived', () => {
          this.requestsInFlight -= 1;

          if (this.requestsInFlight === 0) {
            resolve();
          }
        }));

        self.setState({
          viewConfig: newViewConfig,
          views: viewsByUid,
        }, () => {

        });
      });

      return p;
    },

    /**
     * Get the minimum and maximum visible values for a given track.
     *
     * @param {string} viewId The id of the view containing the track.
     * @param {string} trackId The id of the track to query.
     * @param {bool} [ignoreOffScreenValues=false] If ``true`` only truly visible values
     *  are considered. Otherwise the values of visible tiles are used. Not that
     *  considering only the truly visible
     *  values results in a roughly 10x slowdown (from 0.1 to 1 millisecond).
     * @param {bool} [ignoreFixedScale=false]  If ``true`` potentially fixed scaled values are
     *  ignored. I.e., if the
     *  absolute range is ``[1, 18]`` but you have fixed the output range to
     *  ``[4, 5]`` you would normally retrieve ``[4, 5]``. Having this option set to
     *  ``true`` retrieves the absolute ``[1, 18]`` range.
     * @example
     * const [minVal, maxVal] = hgv.getMinMaxValue('myView', 'myTrack');
     * @returns {Array} The minimum and maximum value
     */
    getMinMaxValue(
      viewId,
      trackId,
      ignoreOffScreenValues = false,
      ignoreFixedScale = false
    ) {
      return self.getMinMaxValue(
        viewId,
        trackId,
        ignoreOffScreenValues,
        ignoreFixedScale
      );
    },

    /**
     * Generate a sharable link to the current view config. The `url` parameter should contain
     * the API endpoint used to export the view link (e.g. 'http://localhost:8989/api/v1/viewconfs').
     * If it is not provided, the value is taken from the `exportViewUrl` value of the viewconf.
     *
     * @param {string}  url  Custom URL that should point to a higlass server's
     *   view config endpoint, i.e.,
     *   `http://my-higlass-server.com/api/v1/viewconfs/`.
     * @returns {Object}  Promise resolving to the link ID and URL.
     * @example
     * hgv.shareViewConfigAsLink('http://localhost:8989/api/v1/viewconfs')
     * .then((sharedViewConfig) => {
     *   console.log(`Shared view config (ID: ${sharedViewConfig.id}) is available at ${sharedViewConfig.url}`)
     * })
     * .catch((err) => { console.error('Something did not work. Sorry', err); })
     */
    shareViewConfigAsLink(url) {
      return self.handleExportViewsAsLink(url, true);
    },

    /**
     * Show overlays where this track can be positioned
     *
     * @param {obj} track { server, tilesetUid, datatype }
     */
    showAvailableTrackPositions(track) {
      self.setState({
        draggingHappening: track,
      });
    },

    /**
     * Hide the overlay showing where a track can be positioned
     */
    hideAvailableTrackPositions() {
      self.setState({
        draggingHappening: null,
      });
    },

    /**
     *
     * When comparing different 1D tracks it can be desirable to fix their y or value
     * scale
     *
     * @param {string} [viewId=''] The view identifier. If you only have one view this
     * parameter can be omitted.
     *
     * @param {string} [trackId=null] The track identifier.
     * @param [Number] [minValue=null] Minimum value used for scaling the track.
     * @param [Number] [maxValue=null] Maximum value used for scaling the track.
     *
     * @example
     *
     * hgv.setTrackValueScale(myView, myTrack, 0, 100); // Sets the scaling to [0, 100]
     * hgv.setTrackValueScale(myView, myTrack); // Unsets the fixed scaling, i.e., enables dynamic scaling again.
     */
    setTrackValueScaleLimits(viewId, trackId, minValue, maxValue) {
      self.setTrackValueScaleLimits(viewId, trackId, minValue, maxValue);
    },

    /**
     * Choose a theme.
     */
    setDarkTheme(darkTheme) {
      setDarkTheme(!!darkTheme);
    },

    /**
     * Zoom so that the entirety of all the datasets in a view
     * are visible.
     * The passed in ``viewUid`` should refer to a view which is present. If it
     * doesn't, an exception will be thrown. Note that if this function is invoked
     * directly after a HiGlass component is created, the information about the
     * visible tilesets will not have been retrieved from the server and
     * ``zoomToDataExtent`` will not work as expected. To ensure that the
     * visible data has been loaded from the server, use the ``setViewConfig``
     * function and place ``zoomToDataExtent`` in the promise resolution.
     *
     * @param {string} viewUid The view uid of the view to zoom
     * @example
     *
     * const p = hgv.setViewConfig(newViewConfig);
     * p.then(() => {
     *     hgv.zoomToDataExtent('viewUid');
     * });
     */
    zoomToDataExtent(viewUid) {
      self.handleZoomToData(viewUid);
    },

    /**
     * The endpoint allows you to reset the viewport to the initially defined X and Y
     * domains of your view config.
     *
     * @param {string} viewId The view identifier. If you have only one view you can
     * omit this parameter.
     *
     * @example
     *
     * hgv.resetViewport(); // Resets the first view
     */
    resetViewport(viewId) {
      self.resetViewport(viewId);
    },

    /**
     * Some tools needs conflicting mouse events such as mousedown or mousemove. To
     * avoid complicated triggers for certain actions HiGlass supports different mouse
     * tools for different interactions. The default mouse tool enables pan&zoom. The
     * only other mouse tool available right now is ``select``, which lets you brush
     * on to a track to select a range for annotating regions.
     *
     * @param {string} [mouseTool='']  Select a mouse tool to use. Currently there
     * only 'default' and 'select' are available.
     *
     * @example
     *
     * hgv.activateTool('select'); // Select tool is active
     * hgv.activateTool(); // Default pan&zoom tool is active
     */
    activateTool(tool) {
      switch (tool) {
        case 'select':
          self.setMouseTool(MOUSE_TOOL_SELECT);
          break;

        default:
          self.setMouseTool(MOUSE_TOOL_MOVE);
          break;
      }
    },

    /**
     * Get the current view as a Data URI
     *
     * @returns {string} A data URI describing the current state of the canvas
     */
    exportAsPng() {
      return self.createDataURI();
    },

    /**
     * Get the current view as an SVG. Relies on all the tracks implementing
     * their respective exportAsSVG methods.
     *
     * @returns {string} An SVG string of the current view.
     */
    exportAsSvg() {
      return self.createSVGString();
    },

    /**
     * Export the current view as a Viewconf.
     *
     * @returns {string} A stringified version of the current viewconf
     */
    exportAsViewConfString() {
      return self.getViewsAsString();
    },

    /**
     * Get the current range selection
     *
     * @return {Array} The current range selection
     */
    getRangeSelection() {
      return self.rangeSelection;
    },

    /**
     * Get the current location for a view.
     *
     * @param {string} [viewId=null] The id of the view to get the location for
     * @returns {obj} A an object containing two Arrays representing the domains of
     *  the x andy scales of the view.
     * @example
     *
     * const {xScale, yScale} = hgv.getLocation('viewId');
     */
    getLocation(viewId) {
      const wurstId = viewId
        ? self.xScales[viewId] && self.yScales[viewId] && viewId
        : Object.values(self.tiledPlots)[0] && Object.values(self.tiledPlots)[0].props.uid;

      if (!wurstId) {
        return 'Please provide a valid view UUID sweetheart 😙';
      }

      return {
        xDomain: self.xScales[wurstId].domain(),
        yDomain: self.yScales[wurstId].domain()
      };
    },

    /**
     * Change the current view port to a certain data location.  When ``animateTime`` is
     * greater than 0, animate the transition.

     * If working with genomic data, a chromosome info file will need to be used in
     * order to calculate "data" coordinates from chromosome coordinates. "Data"
     * coordinates are simply the coordinates as if the chromosomes were placed next
     * to each other.
     *
     * @param {string} viewUid The identifier of the view to zoom
     * @param {Number} start1Abs The x start position
     * @param {Number} end1Abs The x end position
     * @param {Number} start2Abs (optional) The y start position. If not specified
     *    start1Abs will be used.
     * @param {Number} end2Abs (optional) The y end position. If not specified
     *    end1Abs will be used
     * @example
     *    // Absolute coordinates
     * hgApi.zoomTo('view1', 1000000, 1000000, 2000000, 2000000, 500);
     * // Chromosomal coordinates
     * hglib
     *   // Pass in the URL of your chrom sizes
     *   .ChromosomeInfo('//s3.amazonaws.com/pkerp/data/hg19/chromSizes.tsv')
     *   // Now we can use the chromInfo object to convert
     *   .then((chromInfo) => {
     *     // Go to PTEN
     *     hgApi.zoomTo(
     *       viewConfig.views[0].uid,
     *       chromInfo.chrToAbs(['chr10', 89596071]),
     *       chromInfo.chrToAbs(['chr10', 89758810]),
     *       chromInfo.chrToAbs(['chr10', 89596071]),
     *       chromInfo.chrToAbs(['chr10', 89758810]),
     *       2500  // Animation time
     *     );
     *   });
     *   // Just in case, let us catch errors
     *   .catch(error => console.error('Oh boy...', error))
     */
    zoomTo(
      viewUid,
      start1Abs,
      end1Abs,
      start2Abs,
      end2Abs,
      animateTime = 0,
    ) {
      self.zoomTo(viewUid, start1Abs, end1Abs, start2Abs, end2Abs, animateTime);
    },


    /**
     * Cancel a subscription.
     *
     * @param {string} event One of the available events
     * @param {function} listener The function to unsubscribe
     * @param {string} viewId The viewId to unsubscribe it from (not strictly necessary)
     * The variables used in the following examples are coming from the examples of ``on()``.
     *
     * @example
     *
     * hgv.off('location', listener, 'viewId1');
     * hgv.off('rangeSelection', rangeListener);
     * hgv.off('viewConfig', viewConfigListener);
     * hgv.off('mouseMoveZoom', mmz);
     */
    off(event, listenerId, viewId) {
      const callback = typeof listenerId === 'object'
        ? listenerId.callback
        : listenerId;

      switch (event) {
        case 'location':
          self.offLocationChange(viewId, listenerId);
          break;

        case 'mouseMoveZoom':
          apiPubSub.unsubscribe('mouseMoveZoom', callback);
          break;

        case 'rangeSelection':
          apiPubSub.unsubscribe('rangeSelection', callback);
          break;

        case 'viewConfig':
          self.offViewChange(listenerId);
          break;

        default:
          // nothing
          break;
      }
    },

    /**
     * Subscribe to events
     *
     *
     * HiGlass exposes the following event, which one can subscribe to via this method:
     *
     * - location
     * - rangeSelection
     * - viewConfig
     * - mouseMoveZoom
     *
     * **Event types**
     *
     * ``location:`` Returns an object describing the visible region
     *
     * .. code-block:: javascript
     *
     *    {
     *        xDomain: [1347750580.3773856, 1948723324.787681],
     *        xRange: [0, 346],
     *        yDomain: [1856870481.5391564, 2407472678.0075483],
     *        yRange: [0, 317]
     *    }
     *
     * ``rangeSelection:`` Returns a BED- (1D) or BEDPE (1d) array of the selected data and genomic range (if chrom-sizes are available)
     *
     * .. code-block:: javascript
     *
     *  // Global output
     *  {
     *    dataRange: [...]
     *    genomicRange: [...]
     *  }
     *
     *  // 1D data range
     *  [[1218210862, 1528541001], null]
     *
     *  // 2D data range
     *  [[1218210862, 1528541001], [1218210862, 1528541001]]
     *
     *  // 1D or BED-like array
     *  [["chr1", 249200621, "chrM", 50000], null]
     *
     *  // 2D or BEDPE-like array
     *  [["chr1", 249200621, "chr2", 50000], ["chr3", 197972430, "chr4", 50000]]
     *
     * ``viewConfig:`` Returns the current view config.
     *
     * ``mouseMoveZoom:`` Returns the raw data around the mouse cursors screen location and the related genomic location.
     *
     * .. code-block:: javascript
     *
     *  {
     *    data, // Raw Float32Array
     *    dim,  // Dimension of the lens (the lens is squared)
     *    toRgb,  // Current float-to-rgb converter
     *    center,  // BED array of the cursors genomic location
     *    xRange,  // BEDPE array of the x genomic range
     *    yRange,  // BEDPE array of the y genomic range
     *    rel  // If true the above three genomic locations are relative
     *  }
     *
     * @param {string} event One of the events described below
     *
     * @param {function} callback A callback to be called when the event occurs
     *
     * @param {string} viewId The view ID to listen to events
     *
     * @example
     *
     *  let locationListenerId;
     * hgv.on(
     *   'location',
     *   location => console.log('Here we are:', location),
     *   'viewId1',
     *   listenerId => locationListenerId = listenerId
     * );
     *
     * const rangeListenerId = hgv.on(
     *   'rangeSelection',
     *   range => console.log('Selected', range)
     * );
     *
     * const viewConfigListenerId = hgv.on(
     *   'viewConfig',
     *   range => console.log('Selected', range)
     * );
     *
     *  const mmz = event => console.log('Moved', event);
     *  hgv.on('mouseMoveZoom', mmz);
     */
    on(event, callback, viewId, callbackId) {
      switch (event) {
        case 'location':
          // returns a set of scales (xScale, yScale) on every zoom event
          return self.onLocationChange(viewId, callback, callbackId);

        case 'mouseMoveZoom':
          return apiPubSub.subscribe('mouseMoveZoom', callback);

        case 'rangeSelection':
          return apiPubSub.subscribe('rangeSelection', callback);

        case 'viewConfig':
          return self.onViewChange(callback);

        default:
          return undefined;
      }
    },
  };
};


export default api;
export const { publish } = apiPubSub;
