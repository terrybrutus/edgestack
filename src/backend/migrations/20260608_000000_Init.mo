import List "mo:core/List";

module {
  type Item = {
    id : Nat;
    title : Text;
    status : { #todo; #done };
  };

  type OldActor = {};

  type NewActor = {
    items : List.List<Item>;
    state : { var nextId : Nat };
  };

  public func migration(_ : OldActor) : NewActor {
    {
      items = List.empty<Item>();
      state = { var nextId = 0 };
    };
  };
};
