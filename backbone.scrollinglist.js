/**
 * Handling of touch-scrollable lists 
 * 
 * We use the iscroll library for the actual scrolling, then add in a couple of optimizations:
 * - Lazy load images one at a time with a small delay in between
 * - "paginate" the data by using absolute positioning and toggling display on and off for individual rows
 */
TouchScrollListView = Backbone.View.extend({
  events: {
    'touchstart ul': 'touchstart'
  },
  
  /**
   * The frequency (in milliseconds) with which we try to lazy load images on the screen
   */
  lazyImageLoadInterval: 50,
  
  /**
   * Configuration options:
   * * +el+ - The element containing the +ul+ to scroll
   * * +template+ - A function to generate a string containing the default template to render for each list item.  This must contain a top-level +li+ tag.
   * * +data+ - The souce of data being listed
   * * +itemHeight+ - A function to calculate the height of the item at the specified index
   * * +render+ - A function to render the element at the given index
   * * +lazyImages+ - A function to get the lazy image url to render for the element at the given index. Default is to assume there are no lazy images.
   * * +alphanav+ - A function to specify the index locations of the first item that starts with each letter of the alphabet.  If set, this will enable the alpha navigation bar.
   * 
   * == Examples
   * 
   * As just a basic scroller with pre-rendered content:
   *      
   *   new TouchScrollListView({el: $element});
   * 
   * With an infinitely scrolling list:
   * 
   *   new TouchScrollListView({
   *     el: $element,
   *     template: '<li class="user-list-item"><span class="name"></span></li>',
   *     data: [{id: 1, small: false}, {id: 2, small: true}, {id: 3, small: false}],
   *     itemHeight: function(index, data) {
   *       return data.small ? 50 : 100;
   *     },
   *     render: function(item) {
   *       // item.index, item.element, item.data
   *       item.element.find('.name').text('Row ' + item.index);
   *     },
   *     lazyImages: function(index, data) {
   *       return [{selector: '.lazy', src: 'http://placekitten.com/200/1' + index}];
   *     },
   *     alphanav: function(data) {
   *       return {a: 0, b: 2, f: 3};
   *     }
   *   });
   */
  initialize: function(opts) {
    this.options = $.extend({
      // The percentage of the visible area to buffer on either side.  This is
      // currently 100% since some of the slower devices need a little more buffer.
      bufferPercent: 100,
      
      // Default to a disabled alphanav
      alphanav: false,

      // By default, immediately render
      renderOnInit: true
    }, opts);
    
    _.bindAll(this,
      'checkPagination', 'renderScroller', 'checkLazyImages', 'layoutChanged',
      'scrollOrTouchEnd', 'alphanavStart', 'alphanavMove', 'alphanavEnd'
    );
    
    if (this.options.renderOnInit) { this.render(); }
  },
  
  /**
   * Renders all of the necessary elements on the screen.  Note that this will
   * not immediately render items in the list.
   */
  render: function() {
    if (!this._rendered) {
      // Render the elements on the screen
      this.renderScroller();
      if (this.options.alphanav) {
        this.renderAlphaNav();
      }
      
      // Force the initial event to indicate that there's new data registered
      this.dataChanged();
      
      // Defer this call so that the DOM is fully updated before initializing iscroll
      $(this.el).bind('refreshscrollers', this.layoutChanged);
      _.defer(this.layoutChanged);

      this._rendered = true;
    }

    return this;
  },

  /**
   * Renders the list containing the scrollable elements
   */
  renderScroller: function() {
    this.iscroll = new iScroll(this.el, {
      desktopCompatibility: true,
      onPositionChange: this.checkPagination,
      onScrollEnd: this.scrollOrTouchEnd,
      onTouchEnd: this.scrollOrTouchEnd,
      vScrollbar: !this.options.alphanav
    });
    
    this.$list = $(this.el).children('ul');
  },
  
  /**
   * Renders a navigation bar for scrolling to an item that starts with a
   * particular character of the alphabet.
   */
  renderAlphaNav: function() {
    // This currently adds the alphanav to a layout element that's specific to the
    // Viximo layout
    var $searchBox = $(this.el).parents('.main-content').find('.search-box');
    
    this.$alphanav = $('<div />').addClass('alphanav');
    var $alphalist = $('<ul />')
      .css({height: this.getVisibleHeight() + $searchBox.outerHeight(true) - 10})
      .appendTo(this.$alphanav);
    
    // Hook up events for touch scrolling
    this.$alphanav.bind(this.alphanavEvents().start, this.alphanavStart);

    // Render individual letters
    var letters = this.getAlphaNavLetters();
    for (var i = 0; i < letters.length; i++) {
      var letter = letters[i];
      $('<li />').addClass('alphanav-item').append($('<span />').text(letter.toUpperCase())).appendTo($alphalist);
    }
    
    $searchBox.append(this.$alphanav);
  },
  
  /**
   * Scroll to a pixel position in the list. The y axis is reversed so that all values are on a
   * plane of positive numbers
   */
  scrollTo: function(x, y) {
    this.iscroll.scrollTo(x, -y);
  },
  
  /**
   * Gets the x-y position from the given event
   */
  positionFromEvent: function(event) {
    var hasTouch = 'ontouchstart' in window;
    var point = hasTouch ? event.originalEvent.touches[0] : event;
    return {x: point.pageX, y: point.pageY};
  },

  /**
   * Gets the events to apply to alpha navigation
   */
  alphanavEvents: function() {
    var hasTouch = 'ontouchstart' in window;
    var events;
    if (hasTouch) {
      events = {start: 'touchstart', move: 'touchmove', end: 'touchend touchcancel'};
    } else {
      events = {start: 'mousedown', move: 'mousemove', end: 'mouseup'};
    }
    
    return events;
  },
  
  /**
   * Event when the user has begun scrolling using the alpha navigation
   */
  alphanavStart: function(event) {
    this.alphanavChanged = false;
    this.alphanavRunning = true;
    this.$alphanav.addClass('hovering');
    event.preventDefault();
    
    // Start tracking the touch movements
    var events = this.alphanavEvents();
    $('body').bind(events.move, this.alphanavMove).bind(events.end, this.alphanavEnd);
  },
  
  /**
   * Event when the user moved the current location on the alphanav scrollbar
   */
  alphanavMove: function(event) {
    this.alphanavChanged = true;
    
    // Update to the latest nav position
    var target = document.elementFromPoint(this.getAlphaNavLeft(), this.positionFromEvent(event).y);
    this.alphanavTo(target);
  },
  
  /**
   * Event when the user has completed scrolling using the alpha navigation
   */
  alphanavEnd: function(event) {
    // Navigate to the element that was clicked if the end event didn't occur
    // after a move event
    if (!this.alphanavChanged) {
      var target = event.srcElement;
      this.alphanavTo(target);
    }
    
    this.alphanavChanged = false;
    this.alphanavRunning = false;
    this.$alphanav.removeClass('hovering');
    event.preventDefault();
    
    // Stop tracking touch movements
    var events = this.alphanavEvents();
    $('body').unbind(events.move, this.alphanavMove).unbind(events.end, this.alphanavEnd);
    
    // Resume trying lazy loading
    setTimeout(this.checkLazyImages, this.lazyImageLoadInterval);
  },

  /**
   * Navigates to the first item in the list that starts with the letter that
   * was clicked
   */
  alphanavTo: function(target) {
    var letter = $(target).text();
    
    // Find and navigate to start of name group
    var top = this.getAlphaNavPositions()[letter.toLowerCase()];
    var bottom = this.getMaxScrollPosition();
    this.scrollTo(0, Math.min(top, bottom));
    
    // Update the items in the list based on the new location
    this.checkPagination();
  },
  
  /**
   * Gets the list of letters to display in the alphanav
   */
  getAlphaNavLetters: function() {
    var letters = ['#'];
    for (var i = 0; i < 26; i++) {
      letters.push(String.fromCharCode(97 + i));
    }
    
    return letters;
  },
  
  /**
   * Gets a a list of the characters in the alphabet and the index location in
   * the list that they map to.  This is guaranteed to return every character.
   */
  getAlphaNavPositions: function() {
    if (!this.alphanavPositions) {
      var indexes = this.options.alphanav(this.options.data);
      this.alphanavPositions = {};
      
      var top = 0;
      var previousIndex = 0;
      var letters = this.getAlphaNavLetters();
      
      for (var i = 0; i < letters.length; i++) {
        var letter = letters[i];
        var index = indexes[letter];
        if (index != null) {
          // Calculate where the letter will be located based on the location of
          // the previous index
          for (var j = previousIndex; j < index; j++) {
            top += this.getItemHeight(j);
          }
          previousIndex = index;
        }
        
        this.alphanavPositions[letter] = top;
      }
    }
    
    return this.alphanavPositions;
  },
  
  /**
   * Gets the left position of the alphanav
   */
  getAlphaNavLeft: function() {
    if (!this.alphanavLeft) {
      this.alphanavLeft = this.$alphanav.find('ul').offset().left;
    }
    return this.alphanavLeft;
  },

  /**
   * Calculates the *maximum* visible height of this scroll list in the current
   * view.  This is either going to be the width or height of the view since the
   * orientation may change.
   */
  getMaxVisibleHeight: function() {
    return Math.max(this.getVisibleHeight(), this.getVisibleWidth());
  },
  
  /**
   * Calculates the current visible height of the scroller
   */
  getVisibleHeight: function() {
    if (!this.visibleHeight) {
      this.visibleHeight = $(this.el).height();
    }
    return this.visibleHeight;
  },
  
  /**
   * Calculates the current visible width of the scroller
   */
  getVisibleWidth: function() {
    if (!this.visibleWidth) {
      this.visibleWidth = $(this.el).width();
    }
    return this.visibleWidth;
  },
  
  /**
   * Calculates the total scrollable height based on the height of each item in the
   * list and the number of items in the list
   */
  getScrollableHeight: function() {
    if (!this.scrollableHeight) {
      this.scrollableHeight = 0;
      for (var i = 0; i < this.options.data.length; i++) {
        this.scrollableHeight += this.getItemHeight(i);
      }
    }
    return this.scrollableHeight;
  },
  
  /**
   * Calculates the total buffer height based on the current visible height of
   * the list
   */
  getBufferHeight: function() {
    return this.getMaxVisibleHeight() * this.options.bufferPercent / 100;
  },
  
  /**
   * Gets the top y-position of the visible list area on the screen.  This is
   * converted to a positive value for easier calculations.
   */
  getVisibleTop: function() {
    return -this.iscroll.y;
  },
  
  /**
   * Gets the bottom y-position of the visible list area on the screen
   */
  getVisibleBottom: function() {
    return this.getVisibleTop() + this.getVisibleHeight();
  },
  
  /**
   * Gets the top of the page that's being rendered, including the buffer amount
   */
  getPageTop: function() {
    return this.getVisibleTop() - this.getBufferHeight();
  },
  
  /**
   * Gets the bottom of the page that's being rendered, including the buffer amount
   */
  getPageBottom: function() {
    return this.getVisibleBottom() + this.getBufferHeight();
  },
  
  /**
   * Gets the full maximum height of the page that can be rendered.  This is
   * calculated as the maximum visible area for the list plus any buffering
   * around it.
   */
  getPageHeight: function() {
    return this.getPageBottom() - this.getPageTop();
  },
  
  /**
   * Gets the height of the item at the given index
   */
  getItemHeight: function(index) {
    var height;
    if (typeof(this.options.itemHeight) == 'function') {
      height = this.options.itemHeight(index, this.options.data[index]);
    } else {
      height = this.options.itemHeight;
    }
    return height;
  },
  
  /**
   * Gets the number of template items to render in a page.  This is calculated
   * by looking at the heights of each item in the list and determining the maximum
   * that could fit given the height of the page.
   */
  getTemplateCount: function() {
    // Track the currently calculated template count as well as the maximum height
    // that we can use
    var templateCount = 0;
    var pageHeight = this.getPageHeight();
    
    // Keep track of the total height of items that we previously looped over
    // as well as the index we started counting at.
    var lastHeight = 0;
    var startIndex = 0;
    
    for (var i = 0; i < this.options.data.length; i++) {
      var height = lastHeight + this.getItemHeight(i);
      
      if (height <= pageHeight) {
        templateCount = Math.max(templateCount, i - startIndex + 1);
      } else {
        // Move the start index until we're within the bounds of the page
        for (var j = startIndex; j < i && height > pageHeight; j++) {
          height -= this.getItemHeight(j);
          startIndex += 1;
        }
      }
      
      lastHeight = height;
    }
    
    return templateCount;
  },
  
  /**
   * Gets the maximum scroll position that can be used in this list.  If the
   * scroll position is set to this value, only the last few elements in the list
   * will be displayed on the screen.
   */
  getMaxScrollPosition: function() {
    return Math.max(0, this.getScrollableHeight() - this.getVisibleHeight());
  },
  
  /**
   * Callback when a touch event has started
   */
  touchstart: function() {
    this.touching = true;
  },

  /**
   * Callback when either a scroll or touch event has ended.
   */
  scrollOrTouchEnd: function() {
    // We don't get a proper scroll end event if it was interupted by a touch -- 
    // in this case, we can check "animating" to see if the touch end resulted in a scroll or not.
    if (!this.iscroll.animating) {
      this.touching = false;
      
      // Resume trying lazy loading
      setTimeout(this.checkLazyImages, this.lazyImageLoadInterval);
    }
  },
  
  /**
   * Callback when the layout of the scroll list has been modified, such as
   * when switching between landscape and portrait
   */
  layoutChanged: function() {
    if (this.iscroll) {
      this.visibleHeight = null;
      this.visibleWidth = null;
      this.alphanavLeft = null;
      this.iscroll.refresh();
    }
  },

  /**
   * Creates the list of static elements containing the initial templates
   */ 
  createStaticItems: function() {
    var templateCount = this.getTemplateCount();
    for (var i = 0; i < templateCount; i++) {
      var $el = $(this.options.template).css({position: 'absolute'}).click(_.bind(this.itemClick, this));
      $el.bind(this.alphanavEvents().start, _.bind(this.itemClickStart, this));
      
      this.items.push({element: $el, index: null, top: null, bottom: null, selectors: {}});
    }
    
    this.$list.append.apply(this.$list, _.map(this.items, function(item) { return item.element; }));
  },
  
  /**
   * Tracks the location of the mouse when a click has begun.  This will be ignored
   * if the scroll list is animating in which case this event will never result in
   * a real mouse click.
   */
  itemClickStart: function(e) {
    if (!this.iscroll.animating) {
      var position = this.positionFromEvent(e);
      this.lastMouseX = position.x;
      this.lastMouseY = position.y;
    } else {
      this.lastMouseX = this.lastMouseY = -1;
    }
  },
  
  /**
   * Event when an item is clicked in the list.  This prevents clicks from being
   * misinterpreted when we're scrolling.  Clicks only get processed when the
   * mouse hasn't moved since the mousedown event.
   */
  itemClick: function(e) {
    if (this.lastMouseX != e.pageX || this.lastMouseY != e.pageY) {
      e.stopImmediatePropagation();
    }
  },
  
  /**
   * Resets all of the precalculated values for the list
   */
  reset: function() {
    this.items = [];
    this.imageStatuses = {};
    this.alphanavPositions = null;
    this.scrollableHeight = null;
    this.lastVisibleTop = null;
    this.$list.empty();
  },
  
  /**
   * This is used to fix a strange bug in Android where the screen sometimes
   * doesn't refresh after you've made changes to the styles of elements on
   * the screen.  By just switching the visibility of this element, we can
   * force the screen to refresh.
   */
  forceScreenRefresh: function() {
    if (!this.$refresher) {
      this.$refresher = $('<div />').css({position: 'absolute', width: 1, height: 1, top: 0, left: 0, background: 'transparent', border: 'none'}).appendTo(this.el);
    }

    _.delay(_.bind(function() { this.value = !this.value; this.$refresher.css({zIndex: this.value ? 1 : 0}); }, this), 250);
  },
  
  /**
   * Callback when the data backing this scroll list has been modified
   */
  dataChanged: function(data) {
    // Update datastore
    if (data) {
      this.options.data = data;
    }
    
    // Scroll back to the beginning
    this.scrollTo(0, 0);
    
    // Create the list of static items and set the full height of the list based
    // on those items
    if (this.options.data) {
      this.reset();
      this.createStaticItems();
      this.$list.css({height: this.getScrollableHeight()});
    }
    
    // Force iscroll to recognize the new height of the list
    this.iscroll.refresh();
    
    // Update the contents of the items
    this.checkPagination();
    
    // Schedule an attempt to start lazily loading images
    setTimeout(this.checkLazyImages, this.lazyImageLoadInterval);
  },
  
  /**
   * Gets the data for the given element.  This is expected to be an actual DOM
   * element and not a jQuery object.
   */
  getDataForElement: function(element) {
    var item = _.find(this.items, function(item) { 
      return item.element[0] == element; 
    });
    return item && item.data;
  },
  
  /**
   * Checks the current scroll position to determine whether or not new items
   * need to be rendered on the screen.
   */
  checkPagination: function() {
    // No-op if there's no need to currently check for pagination
    if (!this.shouldCheckPagination()) return;
    
    // The list of items to move during this check
    var itemsToMove = [];
    
    if (this.isScrollingToBottom()) {
      // We're scrolling down to the bottom of the list; take items from the
      // top and push them to the bottom
      itemsToMove = this.getItemsToMoveToBottom();
      if (itemsToMove.length) {
        this.moveItemsToBottom(itemsToMove);
      }
    } else {
      // We're scrolling up to the top of the list; take items from the bottom
      // and push them to the top
      itemsToMove = this.getItemsToMoveToTop();
      if (itemsToMove.length) {
        this.moveItemsToTop(itemsToMove);
      }
    }
    
    // Track the last scroll position that we moved items
    this.lastVisibleTop = this.getVisibleTop();
    
    // Load any images that have been previously loaded through the lazy check timer
    this.loadLazyImages(itemsToMove, true);
    
    this.forceScreenRefresh();
  },
  
  /**
   * Checks whether the scroll position has ever been marked for this list
   */
  hasScrolled: function() {
    return this.lastVisibleTop != null;
  },
  
  /**
   * Gets the distance that has been scrolled since the last time we checked
   * the pagination.  This is always guaranteed to be a non-negative number.
   */
  getScrollDistance: function() {
    return Math.abs(this.getVisibleTop() - this.lastVisibleTop);
  },
  
  /**
   * Gets the distance required to be scrolled until the next pagination check
   * needs to occur
   */
  getDistanceForNextCheck: function() {
    var distance;
    if (this.isScrollingToBottom()) {
      var lastItem = this.items[this.items.length - 1];
      distance = lastItem.index < (this.options.data.length - 1) && this.getItemHeight(lastItem.index + 1);
    } else {
      var firstItem = this.items[0];
      distance = firstItem && firstItem.index > 0 && this.getItemHeight(firstItem.index - 1);
    }
    
    // If there's no distance detected, we'll set something high to avoid unnecessary
    // checks
    return distance || 1000;
  },
  
  /**
   * Calculates whether we should be checking to swap items from one side of
   * the list to the other.  This should only happen when we've moved far enough
   * to warrant a swap (minimum distance is determed by the minimum item height).
   */
  shouldCheckPagination: function() {
    return this.options.data && (!this.hasScrolled() || this.getScrollDistance() >= this.getDistanceForNextCheck());
  },
  
  /**
   * Checks whether we're currently scrolling to the bottom of the list.  If the
   * user has never scrolled before, then we'll consider that scrolling to the
   * bottom just for simplicity's sake.
   */
  isScrollingToBottom: function() {
    return !this.hasScrolled() || this.getVisibleTop() > this.lastVisibleTop;
  },
  
  /**
   * Find all items at the top that are outside the starting bounds and
   * push them onto the bottom of the list.  Make sure we keep in mind that
   * there is a maximum amount that we can move if we're near the end of
   * the list.
   */
  getItemsToMoveToBottom: function() {
    var itemsToMove = [];
    if (!this.hasScrolled()) {
      // Mark all of the items to be moved
      itemsToMove.push.apply(itemsToMove, this.items);
    } else {
      // Calculate the maximum number of items we can move right now to the bottom
      var lastItem = this.items[this.items.length - 1];
      var itemsRemaining = this.options.data.length - lastItem.index - 1;
      var maxToMove = Math.min(this.items.length, itemsRemaining);
      
      // Move any items that are outside the bounds of the list; the first one
      // we detect that in bounds stops the loop
      var pageTop = this.getPageTop();
      for (var i = 0; i < maxToMove; i++) {
        var item = this.items[i];
        if (item.top < pageTop) {
          itemsToMove.push(item);
        } else {
          break;
        }
      }
    }
    
    return itemsToMove;
  },
  
  /**
   * Moves the given items to the bottom of the list.  It is assumed that these
   * items are all at the top of the +this.items+ array.
   */
  moveItemsToBottom: function(itemsToMove) {
    var top, index;
    if (!this.hasScrolled()) {
      // This is the first time we're positioning the items; start at the default
      // 0-based position
      top = 0;
      index = 0;
    } else {
      // The items that are going to be moved to the bottom will start as the
      // very next item from the current last item in the list
      var lastItem = this.items[this.items.length - 1];
      top = lastItem.bottom;
      index = lastItem.index + 1;
    }
    
    // Keep moving the positioning until we've got an element that's within
    // the bounds of the list.  This will only happen if the current scroll
    // caused us to be a position so far away that the whole list of static
    // elements are moved.
    var pageTop = this.getPageTop();
    while (top <= pageTop && (this.options.data.length - index) > this.items.length) {
      top += this.getItemHeight(index);
      index += 1;
    }
    
    // Actually start moving the items
    for (var i = 0; i < itemsToMove.length; i++) {
      var item = itemsToMove[i];
      
      // Update the positioning for this item
      item.index = index + i;
      item.data = this.options.data[item.index];
      item.top = top;
      item.bottom = top + this.getItemHeight(item.index);
      item.element[0].style.top = top + 'px';
      
      // Render the new contents
      this.options.render(item);
      
      // Update the position for the next item
      top = item.bottom;
      
      // Adjust the location of item in the list
      this.items.push(this.items.shift());
    }
  },
  
  /**
   * Find all items at the bottom that are outside the bottom bounds of the
   * list and pushes them onto the top of the list.  Make sure we keep in mind
   * that there is a maximum amount that we can move if we're near the beginning
   * of the list.
   */
  getItemsToMoveToTop: function() {
    var itemsToMove = [];
    
    // Calculate the maximum number of items we can move right now to the top
    var firstItem = this.items[0];
    var maxToMove = Math.min(this.items.length, firstItem.index);
    
    // Move any items that are outside the bounds of the list; the first one
    // we detect that in bounds stops the loop
    var pageBottom = this.getPageBottom();
    for (var i = 0; i < maxToMove; i++) {
      var item = this.items[this.items.length - i - 1];
      if (item.bottom > pageBottom) {
        itemsToMove.unshift(item);
      } else {
        break;
      }
    }
    
    return itemsToMove;
  },
  
  /**
   * Moves the given items to the top of the list.  It is assumed that these items
   * are all at the end of the +this.items+ array.
   */
  moveItemsToTop: function(itemsToMove) {
    var firstItem = this.items[0];
    
    // The items that are going to be moved to the top will start as the
    // very previous item from the current first item in the list
    var bottom = firstItem.top;
    var index = firstItem.index - 1;
    
    // Keep moving the positioning until we've got an element that's within
    // the bounds of the list.  This will only happen if the current scroll
    // caused us to be a position so far away that the whole list of static
    // elements are moved.
    var pageBottom = this.getPageBottom();
    while (bottom >= pageBottom && index >= this.items.length) {
      bottom -= this.getItemHeight(index);
      index -= 1;
    }
    
    // Actually start moving the items
    for (var i = 0; i < itemsToMove.length; i++) {
      var item = itemsToMove[itemsToMove.length - i - 1];
      
      // Update the positioning for this item
      item.index = index - i;
      item.data = this.options.data[item.index];
      item.bottom = bottom;
      item.top = bottom - this.getItemHeight(item.index);
      item.element[0].style.top = item.top + 'px';
      
      // Render the new contents
      this.options.render(item);
      
      // Update the position for the next item
      bottom = item.top;
      
      // Adjust the location of item in the list
      this.items.unshift(this.items.pop());
    }
  },
  
  /**
   * Determines whether this list has any lazy images to be rednered
   */
  hasLazyImages: function() {
    return this.options.lazyImages != null;
  },
  
  /**
   * Determines whether we can currently load images.  This can only be the
   * case when the user isn't currently scrolling.
   */
  canLoadImages: function() {
    return !this.touching && !this.alphanavRunning;
  },
  
  /**
   * Lazily loads any images that are visible on the screen and have not been
   * previously loaded.
   */
  checkLazyImages: function() {
    if (!this.hasLazyImages()) return;
    
    // Don't do *anything* while a touch is happening to help maintain responsiveness
    if (this.canLoadImages()) {
      // Any items whose images we load must be within the visible range
      var visibleTop = this.getVisibleTop();
      var visibleBottom = this.getVisibleBottom();
      
      for (var i = 0; i < this.items.length; i++) {
        var item = this.items[i];
        if (item.bottom > visibleTop && item.top < visibleBottom) {
          // Item is visible: if there are any lazy images to load, let's do that now
          if (_.any(item.lazyImages, function(image) { return image.status == 'pending'; })) {
            // Load the images for this item
            this.loadLazyImages([item], false);
            
            // Only load the first image we find for performance, reschedule a
            // call to try loading the next one.
            setTimeout(this.checkLazyImages, this.lazyImageLoadInterval);
            break;
          }
        }
      }
    }
  },
  
  /**
   * Eager loads images for the given items.  Images can only be eager loaded
   * if they've been previously loaded in this view.
   * 
   * @param items {Array} The list of items to attempt to eager load
   * @param onlyPreviouslyLoaded {Boolean} Whether to only load previously loaded images
   */
  loadLazyImages: function(items, onlyPreviouslyLoaded) {
    if (!this.hasLazyImages()) return;
    
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      item.lazyImages = this.options.lazyImages(item.index, item.data) || [];
      
      // Set the source for each image ready to be loaded
      for (var j = 0; j < item.lazyImages.length; j++) {
        var lazyImage = item.lazyImages[j];
        this.loadLazyImage(item, lazyImage, onlyPreviouslyLoaded);
      }
    }
  },
  
  /**
   * Loads given lazy image for an item
   */
  loadLazyImage: function(item, lazyImage, onlyPreviouslyLoaded) {
    var src = lazyImage.src;
    var selector = lazyImage.selector;
    lazyImage.status = this.imageStatuses[src] || 'pending';
    
    // Get all of the elements that are considered lazy for this selector
    var selectorResult = this.findLazyElements(item, selector);
    var $elements = selectorResult.all;
    var $image = selectorResult.image;
    var hide = true;
    
    if (lazyImage.src) {
      if (lazyImage.status == 'success' || lazyImage.status == 'pending' && !onlyPreviouslyLoaded) {
        // Set the new source for the image
        $image.unbind('load');
        $image[0].setAttribute('src', src);
        
        var success = _.bind(this.lazyImageLoaded, this, item, item.index, lazyImage, $elements);
        if (lazyImage.status == 'success') {
          // If the image was previously loaded, then we want to display the
          // elements immediately; note also that the +load+ event won't fire
          // for images whose source has been previously loaded
          hide = false;
          success();
        } else {
          // The image hasn't been loaded before: wait for it to complete
          // loading
          lazyImage.status = 'loading';
          
          var error = _.bind(this.lazyImageFailed, this, lazyImage);
          $image.load(success).error(error);
        }
      }
    } else {
      // The image doesn't have any source url so mark it as loaded
      lazyImage.status = 'success';
    }
    
    // Hide the elements since we don't yet have anything loaded
    if (hide) {
      for (var i = 0; i < $elements.length; i++) {
        $elements[i].style.visibility = 'hidden';
      }
    }
  },
  
  /**
   * Finds the lazy elements for the given selector within an item
   */
  findLazyElements: function(item, selector) {
    var selectorResult = item.selectors[selector];
    if (!selectorResult) {
      var $elements = item.element.find(selector);
      item.selectors[selector] = selectorResult = {all: $elements, image: $elements.filter('img')};
    }
    
    return selectorResult;
  },
  
  /**
   * Event when a lazy image has been loaded for an item.  Note that the item
   * may have changed since the image was loaded.  As a result, its important to
   * validate that we're dealing with the same item.
   */
  lazyImageLoaded: function(item, index, lazyImage, $elements) {
    // Mark the item as loaded so that we can optimize for this in the future
    var src = lazyImage.src;
    this.imageStatuses[src] = lazyImage.status = 'success';
    
    // Show the image if it's still rendered for this item
    if (item.index == index) {
      for (var i = 0; i < $elements.length; i++) {
        $elements[i].style.visibility = 'visible';
      }
    }
    
    // Find all other items in the list that have the same lazy image
    this.loadLazyImagesWithSource(src, item);
    
    this.forceScreenRefresh();
  },
  
  /**
   * Immediately loads all lazy images with the given source, skipping the
   * specified item.  This should only be called when it's guaranteed that the
   * source url is in the cache.
   */
  loadLazyImagesWithSource: function(src, itemToSkip) {
    for (var i = 0; i < this.items.length; i++) {
      var item = this.items[i];
      
      if (item != itemToSkip) {
        var lazyImages = item.lazyImages;
        
        for (var j = 0; j < lazyImages.length; j++) {
          var lazyImage = lazyImages[j];
          if (lazyImage.src == src) {
            // Source is the same: update the image and display it
            var selectorResult = this.findLazyElements(item, lazyImage.selector);
            selectorResult.image.unbind('load');
            selectorResult.image[0].setAttribute('src', src);
            for (var k = 0; k < selectorResult.all.length; k++) {
              selectorResult.all[k].style.visibility = 'visible';
            }
            
            lazyImage.status = 'success';
          }
        }
      }
    }
  },
  
  /**
   * Event when the a lazy image has failed to load for an item
   */
  lazyImageFailed: function(lazyImage) {
    // Mark the item as failing to load to make sure we don't try it again in
    // the future
    var src = lazyImage.src;
    this.imageStatuses[src] = lazyImage.status = 'error';
  }
});
