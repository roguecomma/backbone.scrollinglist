ListView = Backbone.View.extend({
  
  events: {},
  
  initialize: function(opts) {
    this.options = opts;

    this.listData = [];

    for(var x = 0; x < 100; x++) {
      this.listData.push({
        id: x,
        name: 'Row Number ' + x,
        avatar: 'default_avatar.png'
      });
    }
  },  
  
  render: function() {  
    $(this.el).html($('#list').html());   
    
    this.scrollList = this.renderScrollers({
      template: $('#scroll_list_item_template').html(), 
      render: _.bind(function(item){
        var element = item.element;

        // Cache the locations of the elements that contain dynamic content
        if (!item.contentElements) {
          item.contentElements = {
            name: element.find('p.name')[0]
          };
        }

        // Update the name
        item.contentElements.name.innerHTML = item.data.name;
      }),

      itemHeight: 52,

      lazyImages: function(index, data) {

        return [{selector: '.lazy', src: data.avatar}];

      },

      data: this.listData

    });

    return this;
  },


  renderScrollers: function(options) {
    var ret = [];

    $(this.el).find('.touch-scroll-list').each(_.bind(function(i, el) {
      var container = $(el);

      //viximo.expandFluidElements(container);
      
            
      if(container.data('scrollList'))
        container.data('scrollList').dataChanged(options ? options.data : undefined);
      else
        container.data('scrollList', new TouchScrollListView($.extend({el: el}, options)));

      ret.push(container.data('scrollList'));
    }, this));

    return ret;
  }
});
