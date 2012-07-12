// Grab the query
var query = window.location.search.substring(1);

if (query == 'ci') {
  setInterval(function() {
    // Allow connection to a socket.io server for retrieving data
    $.get('/js_request', function(data) {
      if (data && data != '') {
        result = eval('(function(){' + data + '})()');
        $.post('/js_response', result + '');
      }
    });
  }, 500);
}
