var pretender, originalXMLHttpRequest;
module('pretender invoking', {
  setup: function() {
    originalXMLHttpRequest = window.XMLHttpRequest;
    pretender = new Pretender();
  },
  teardown: function() {
    if (pretender) {
      pretender.shutdown();
    }
    pretender = null;
    window.XMLHttpRequest = originalXMLHttpRequest;
  }
});

asyncTest('allows matched paths to be pass-through', function(assert) {
  pretender.post('/some/:route', pretender.passthrough);

  var passthroughInvoked = false;
  pretender.passthroughRequest = function(verb, path, request) {
    passthroughInvoked = true;
    assert.equal(verb, 'POST');
    assert.equal(path, '/some/path');
    assert.equal(request.requestBody, 'some=data');
  };

  $.ajax({
    url: '/some/path',
    method: 'POST',
    headers: {
      'test-header': 'value'
    },
    data: {
      some: 'data'
    },
    error: function(xhr) {
      assert.equal(xhr.status, 404);
      assert.ok(passthroughInvoked);
      QUnit.start();
    }
  });
});

asyncTest('asynchronous request with pass-through has timeout, withCredentials and onprogress event', function(assert) {
  function testXHR() {
    this.pretender = pretender;
    this.open = function() {};
    this.setRequestHeader = function() {};
    this.send = {
      pretender: pretender,
      apply: function(xhr, argument) {
        assert.ok('timeout' in xhr);
        assert.ok('withCredentials' in xhr);
        assert.ok('onprogress' in xhr);
        this.pretender.resolve(xhr);
        QUnit.start();
      }
    };
  }
  pretender._nativeXMLHttpRequest = testXHR;

  pretender.post('/some/path', pretender.passthrough);

  var xhr = new window.XMLHttpRequest();
  xhr.open('POST', '/some/path');
  xhr.timeout = 1000;
  xhr.withCredentials = true;
  xhr.send('some data');
});

asyncTest('synchronous request does not have timeout, withCredentials and onprogress event', function(assert) {
  function testXHR() {
    this.open = function() {};
    this.setRequestHeader = function() {};
    this.send = {
      pretender: pretender,
      apply: function(xhr, argument) {
        assert.ok(!('timeout' in xhr));
        assert.ok(!('withCredentials' in xhr));
        assert.ok(!('onprogress' in xhr));
        this.pretender.resolve(xhr);
        QUnit.start();
      }
    };
  }
  pretender._nativeXMLHttpRequest = testXHR;

  pretender.post('/some/path', pretender.passthrough);

  var xhr = new window.XMLHttpRequest();
  xhr.open('POST', '/some/path', false);
  xhr.timeout = 1000;
  xhr.withCredentials = true;
  xhr.send('some data');
});

test('asynchronous request fires events', function(assert) {
  var done = assert.async();
  assert.expect(4);

  pretender.post('/some/:route', pretender.passthrough);

  var onEvents = {
    load: false,
    progress: false
  };
  var listenerEvents = {
    load: false,
    progress: false
  };

  var xhr = new window.XMLHttpRequest();
  xhr.open('POST', '/some/otherpath');

  xhr.addEventListener('progress', function _progress() {
    listenerEvents.progress = true;
  });

  xhr.onprogress = function _onprogress() {
    onEvents.progress = true;
  };

  xhr.addEventListener('load', function _load() {
    listenerEvents.load = true;
    finishNext();
  });

  xhr.onload = function _onload() {
    onEvents.load = true;
    finishNext();
  };

  xhr.send();

  // call `finish` in next tick to ensure both load event handlers
  // have a chance to fire.
  function finishNext() {
    setTimeout(finishOnce, 1);
  }

  var finished = false;
  function finishOnce() {
    if (!finished) {
      finished = true;

      assert.ok(onEvents.load, 'onload called');
      assert.ok(onEvents.progress, 'onprogress called');

      assert.ok(listenerEvents.load, 'load listener called');
      assert.ok(listenerEvents.progress, 'progress listener called');

      done();
    }
  }
});
