// describe("TouchScrollListView", function() {
//   var view;
//   var collection;
//   var bufferPercent = 100;
//   var windowHeight = 1000;
//   var itemHeight = 50;

//   var bufferHeight = bufferPercent/100 * windowHeight;
//   var totalBufferHeight = 2 * bufferHeight;
//   var pageHeight = totalBufferHeight + windowHeight;
//   var visibleItems = windowHeight / itemHeight;
//   var bufferItems = bufferHeight / itemHeight;
//   var pageItems = pageHeight / itemHeight;
//   var $;

//   describe("infinite scrolling", function() {
//     beforeEach(function () {
//       $ = this.window.$;

//       collection = []
//       for(var i=0; i < 1000; i++) { 
//         collection.push({id: i});
//       }

//       var div = $('<div></div>').appendTo($('body'));
//       ul = $('<ul></ul>').appendTo(div).append("<li></li>");
      
//       view = new TouchScrollListView({ 
//         el: div.get(0),
//         data: collection,
//         template: '<li class="list-item"></li>',
//         render: function(item) {
//           // item.index, item.element, item.data
//           item.element
//             .attr('id', "item-" + item.data.id)
//             .text('Row ' + item.data.id);
//         },
//         itemHeight: function(i, data) { return itemHeight; },
//         renderOnInit: false
//       });

//       // Stub out height since the body element is hidden and will have no size
//       spyOn(TouchScrollListView.prototype, 'getVisibleHeight').andReturn(windowHeight);
//     });
    
//     describe("render()", function() {
//       it("should return itself", function() {
//         expect(view.render()).toEqual(view);
//       });

//       it("should render page of items", function() {
//         expect($(view.render().el).find("li").size()).toEqual(pageItems);
//       });

//       it("should render the content for each item to the rows", function() {
//         var $rows = $(view.render().el).find("li");
//         var rowText = _.map($rows, function(item) { return $(item).text(); });
      
//         expect(rowText[0]).toEqual("Row 0");
//         expect(rowText[11]).toEqual("Row 11");
//         expect(rowText[22]).toEqual('Row 22');
//         expect(rowText[pageItems-1]).toEqual('Row ' + (pageItems - 1));
//       });
//     });

//     describe("when scrolling", function() {
//       var $rows;

//       describe("down one item past the page boundary", function() {
//         beforeEach(function() {
//           view.render().scrollTo(0, itemHeight + bufferHeight);
//           $rows = $(view.el).find("li");
//         });

//         it("should remove the first item from the list", function() {
//           expect(_.map($rows, function(i) {return i.id})).toNotContain("item-0");
//         });

//         it("should queue the next item at the top of the buffer", function() {
//           expect($rows[0].id).toEqual('item-' + (pageItems));
//         });
//       });

//       describe("past all buffered items", function() {
//         beforeEach(function() {
//           view.render().scrollTo(0, windowHeight + bufferHeight);
//           $rows = $(view.el).find("li");
//         });

//         // This isn't a great spec. Replace with more intention-revealing ones.
//         it("should have queued an entire page of new items at the top of the buffer", function() {
//           expect($rows[0].id).toEqual("item-"+pageItems);
//           expect($rows[19].id).toEqual("item-"+(pageItems + visibleItems - 1));
//         });

//         it("should have the same number of rows", function() {
//           expect($rows.size()).toEqual(pageItems);
//         });
//       });

//       describe("to the middle of the items", function() {
//         var position;
//         var pageStart;
//         var firstId;

//         beforeEach(function() {
//           position = 100;
//           pageStart = position - bufferItems + 1;
//           view.render().scrollTo(0, position * itemHeight);
//           firstId = view.items[0].data.id;
//         });

//         it("should load the set of data items for the page", function() {
//           var itemIds = _.map(view.items, function(i) { return i.data.id; });
//           var expectedIds = _.map(collection.slice(pageStart, pageStart + pageItems), 
//             function(i) { return i.id });
//           expect(itemIds).toEqual(expectedIds);
//         });

//         describe("and then scrolling down one item", function() {
//           var nextOffset;

//           beforeEach(function() {
//             view.scrollTo(0, view.getVisibleTop() + itemHeight + 1);
//             nextOffset = pageStart + pageItems;
//           });

//           it("should remove the first item from the top of the list", function() {
//             expect(view.items[0].data.id).toEqual(firstId + 1);
//           });

//           it("should set top position of the item to the bottom position of previous item", function() {
//             expect(view.items[pageItems - 1].top).toEqual(view.items[pageItems - 2].bottom)
//           });

//           it("should set top position of the element below the previous element", function() {
//             var $previousElement = $(view.items[pageItems - 2].element);
//             expect(parseInt($(view.items[pageItems - 1].element).css('top')))
//               .toEqual(parseInt($previousElement.css('top')) + itemHeight);
//           });

//           it("should load next data item at end", function() {
//             expect(view.items[pageItems - 1].data.id).toEqual(collection[nextOffset].id);
//           });

//           it("should render newest item at bottom", function() {
//             var sortedElements = _.sortBy($(view.el).find('li'), function(i) { return parseInt($(i).css('top')) });
//             expect(sortedElements[pageItems - 1].id).toEqual("item-"+nextOffset);
//           });
//         });
//       });
//     });


//   });
// });
