# backbone.scrollinglist

*Work in progress*

A performant backbone.js based scrolling list implementation designed for HTML mobile applications. Supports pre-rendered lists and infinitely scrolling lists. 


## Requirements

* `backbone.js`
* `iscroll`
* `jquery`
* `underscore.js`

## Usage

## Configuration options:
el - The element containing the +ul+ to scroll

template - A function to generate a string containing the default template to render for each list item.  This must contain a top-level li tag.

data - The souce of data being listed

itemHeight - A function to calculate the height of the item at the specified index

render - A function to render the element at the given index

lazyImages - A function to get the lazy image url to render for the element at the given index. Default is to assume there are no lazy images

alphaNav - A function to specify the index locations of the first item that starts with each letter of the alphabet.  If set, this will enable the alpha navigation bar

## Examples

As just a basic scroller with pre-rendered content:

```javascript

new TouchScrollListView({el: $element});
```

With an infinitely scrolling list:

```javascript

new TouchScrollListView({
	el: $element,
	template: '<li class="user-list-item"><span class="name"></span></li>',
	data: [{id: 1, small: false}, {id: 2, small: true}, {id: 3, small: false}],
   	itemHeight: function(index, data) {
   		return data.small ? 50 : 100;
   	},
    render: function(item) {
    	// item.index, item.element, item.data
        item.element.find('.name').text('Row ' + item.index);
    },
    lazyImages: function(index, data) {
    	return [{selector: '.lazy', src: 'http://placekitten.com/200/1' + index}];
    },
    alphanav: function(data) {
    	return {a: 0, b: 2, f: 3};
   	}
 });
 ```
