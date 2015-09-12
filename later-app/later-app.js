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
      if (Session.get("hideCompleted")) {
        // If hide completed is checked, filter tasks
        return Tasks.find({checked: {$ne: true}}, {sort: {createdAt: -1}});
      } else {
        // Otherwise, return all of the tasks
        return Tasks.find({}, {sort: {createdAt: -1}});
      }
    },
    hideCompleted: function () {
      return Session.get("hideCompleted");
    },
    incompleteCount: function () {
      return Tasks.find({checked: {$ne: true}}).count();
    },
    friends: function() {
      var case1 = Friends.find({user_id: Meteor.userId()}).map(function(f) {return f.friend_id});
      var case2 = Friends.find({friend_id: Meteor.userId()}).map(function(f) {return f.user_id});
      return case1.concat(case2);
    }
  });

  Template.body.onRendered(function() {
    Meteor.typeahead.inject('.typeahead');
  });

  Template.body.events({
    "submit .new-item-form": function (event) {
      // Prevent default browser form submit
      event.preventDefault();

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
      Meteor.call("addTask", item);

      // Clear form
      event.target.reset();
      $('.new-item-form').hide();
    },
    "change .hide-completed input": function (event) {
      Session.set("hideCompleted", event.target.checked);
    },
    "click .new-item-trigger": function (event) {
        $('.new-item-form').toggle();
    },
    "click .close-form a": function (event) {
      $('.new-item-form').hide();
    }
  });

  Template.task.helpers({
    'getCreator': function () {
      Meteor.call('getUsername', this.creator, function (error, result) {
        creatorName.set(result);
      });
      return creatorName.get();
    },
    'getReceiver': function () {
      Meteor.call('getUsername', this.receiver, function (error, result) {
        receiverName.set(result);
      });
      return receiverName.get();
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

  Template.body.created = function () {
    creatorName = new ReactiveVar();
    receiverName = new ReactiveVar();
  };

  Template.task.events({
    "click .toggle-checked": function () {
      // Set the checked property to the opposite of its current value
      console.log("CHECKED");
      Meteor.call("setChecked", this._id, ! this.checked);
    },
    "click .delete": function () {
      Meteor.call("deleteTask", this._id);
    }
  });

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });

}

Meteor.methods({
  addTask: function (item) {
    // Make sure the user is logged in before inserting a task
    if (! Meteor.userId()) {
      throw new Meteor.Error("not-authorized");
    }

    var receiverID = getIDForUsername(item.receiver);

    if (! receiverID) {
      throw new Meteor.Error("user " + item.receiver + " does not exist");
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

    if (!Friends.findOne({user_id: Meteor.userId(), friend_id: receiverID})) {
      Friends.insert({
        user_id: Meteor.userId(),
        friend_id: receiverID
      })
    }

  },
  deleteTask: function (taskId) {
    var task = Tasks.findOne(taskId);
    if (task.creator !== Meteor.userId()) {
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
