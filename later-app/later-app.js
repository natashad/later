Tasks = new Mongo.Collection("tasks");
Friends = new Mongo.Collection("friends");

if (Meteor.isServer) {
  // This code only runs on the server
  // Only publish tasks that are public or belong to the current user
  Meteor.publish("tasks", function () {
    return Tasks.find(
        { $or: [ {creator: this.userId }, {receiver: this.userId} ] }
    );
  });
  Meteor.publish("friends", function() {
    return Friends.find(
      { $or : [ {user_id: this.userId}, {friend_id: this.userId}]}
    );
  });

  function getUsernameForID(ID) {
    var user =  Meteor.users.findOne({
      _id: ID
    });

    return user? user.username : undefined;
  }

  function getIDForUsername(user) {
    var user =  Meteor.users.findOne({
      username: user
    });

    return user? user._id : undefined;
  }
}

if (Meteor.isClient) {
  // This code only runs on the client
  Meteor.subscribe("tasks");
  Meteor.subscribe("friends");
  Template.body.helpers({
    tasks: function () {
      var exprs = [];

      if (Session.get("articleFilter"))
        exprs.push({type: {$in: ["article"]}});

      if (Session.get("videoFilter"))
        exprs.push({type: {$in: ["video"]}});

      if (Session.get("musicFilter"))
        exprs.push({type: {$in: ["music"]}});

      if (Session.get("otherFilter"))
        exprs.push({type: {$in: ["other"]}});

      if (Session.get("inboxFilter"))
        exprs.push({receiver: {$in: [Meteor.userId()]}});

      if (Session.get("outboxFilter"))
        exprs.push({receiver: {$ne: Meteor.userId()}});

      if (Session.get("hideCompleted"))
        exprs.push({checked: {$ne: true}});

      if (exprs.length > 0)
        return Tasks.find({$or: exprs}, {sort: {createdAt: -1}});
      else
        return Tasks.find({}, {sort: {createdAt: -1}});
    },
    hideCompleted: function () {
      return Session.get("hideCompleted");
    },
    articleFilter: function () {
      return Session.get("articleFilter");
    },
    videoFilter: function () {
      return Session.get("videoFilter");
    },
    musicFilter: function () {
      return Session.get("musicFilter");
    },
    otherFilter: function () {
      return Session.get("otherFilter");
    },
    inboxFilter: function () {
      return Session.get("inboxFilter");
    },
    outboxFilter: function () {
      return Session.get("outboxFilter");
    },
    incompleteCount: function () {
      return Tasks.find({checked: {$ne: true}}).count();
    },
    friends: function() {
      var case1 = Friends.find().map(function(f) {return [f.friend_name, f.user_name]});
      return $.unique([].concat.apply([], case1));
    },
  });

  Template.addItemForm.onRendered(function() {
    Meteor.typeahead.inject();
  }),

  // TODO : move a bunch of this to the form template
  Template.body.events({
    "submit .new-item-form": function (event) {
      // Prevent default browser form submit
      event.preventDefault();
      $('.new-item-form .error').empty();

      // Get value from form element
      var receiver = event.target.item_receiver.value;
      var title = event.target.item_title.value;
      var link = event.target.item_link.value;
      if (link.indexOf('http') !== 0) {
        link = "http://" + link;
      }
      var type = event.target.item_type.value;
      var length = event.target.item_length.value;
      var tags = event.target.item_tags.value;

      var item = {receiver: receiver,
                  title: title,
                  link: link,
                  type: type,
                  length: length,
                  tags: tags
                };


      // Insert a task into the collection
      Meteor.call("addTask", item, function(error, result) {
        if (error) {
          $('.new-item-form .error').html("Error: " + error.reason);
          return;
        } else {
          // Clear form
          event.target.reset();
          $('.new-item-form').hide();
        }
      });

    },
    "click .new-item-trigger": function (event) {
        $('.new-item-form').toggle();
    },
    "click .close-form a": function (event) {
      $('.new-item-form').hide();
    }
  });

  Template.filters.events({
    "change .hide-completed input": function (event) {
      Session.set("hideCompleted", event.target.checked);
    },
     "change .article-filter input": function (event) {
      Session.set("articleFilter", event.target.checked);
    },
     "change .video-filter input": function (event) {
      Session.set("videoFilter", event.target.checked);
    },
     "change .music-filter input": function (event) {
      Session.set("musicFilter", event.target.checked);
    },
     "change .other-filter input": function (event) {
      Session.set("otherFilter", event.target.checked);
    },
    "change .inbox-filter input": function (event) {
      Session.set("inboxFilter", event.target.checked);
    },
    "change .outbox-filter input": function (event) {
      Session.set("outboxFilter", event.target.checked);
    }
  });

  Template.task.helpers({
    'getCreator': function () {
      var f = Friends.findOne({'friend_id' : this.receiver});
      return f ? f.friend_name : '';

    },
    'getReceiver': function () {
      var f = Friends.findOne({'friend_id' : this.receiver});
      return f ? f.friend_name : '';

    },
    'getTypeFontAwesome': function () {
      switch(this.type) {
        case 'article':
          return 'fa-file-text-o';
        case 'video':
          return 'fa-video-camera';
        case 'music':
          return 'fa-headphones';
        case 'other':
          return 'fa-external-link';
      }
    },
    'creatorIsReceiver': function () {
      return this.creator === Meteor.userId();
    },
    'isIncoming': function() {
      return this.receiver == Meteor.userId();
    }
  });

  Template.task.events({
    "click .toggle-checked": function () {
      // Set the checked property to the opposite of its current value
      Meteor.call("setChecked", this._id, ! this.checked);
    },
    "click .delete": function () {
      Meteor.call("deleteTask", this._id);
    }
  });

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });

// End of Client only code
}

Meteor.methods({
  addTask: function (item) {
    // Make sure the user is logged in before inserting a task
    if (! Meteor.userId()) {
      throw new Meteor.Error("not-authorized");
    }

    var receiverID = getIDForUsername(item.receiver);

    if (! receiverID && this.isSimulation) {
      return;
    } else if (! receiverID) {
      throw new Meteor.Error("no-user", "User " + item.receiver + " does not exist");
    }

    Tasks.insert({
      receiver: receiverID,
      title: item.title,
      link: item.link,
      type: item.type,
      length: item.length,
      tags: item.tags,
      createdAt: new Date(),
      creator: Meteor.userId()
    });

    if (!Friends.findOne({user_name: Meteor.user().username, friend_name: item.receiver})) {
      Friends.insert({
        user_name: Meteor.user().username,
        user_id: Meteor.userId(),
        friend_name: item.receiver,
        friend_id: receiverID
      })
    }

  },
  deleteTask: function (taskId) {
    var task = Tasks.findOne(taskId);
    if (task.creator !== Meteor.userId() && task.receiver !== Meteor.userId()) {
      // make sure only the creator can delete it
      throw new Meteor.Error("not-authorized");
    }

    Tasks.remove(taskId);
  },
  setChecked: function (taskId, setChecked) {
    var task = Tasks.findOne(taskId);
    if (task.receiver !== Meteor.userId()) {
      // make sure only the creator can check it off
      throw new Meteor.Error("not-authorized");
    }

    Tasks.update(taskId, { $set: { checked: setChecked} });
  },
  getUsername: function (id) {
    return getUsernameForID(id);
  }
});
