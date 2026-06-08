import Map "mo:core/Map";

module {
  type OldActor = {};

  type NewActor = {
    betHistory : Map.Map<Text, Text>;
    lineOpenStore : Map.Map<Text, Text>;
  };

  public func migration(_ : OldActor) : NewActor {
    {
      betHistory = Map.empty<Text, Text>();
      lineOpenStore = Map.empty<Text, Text>();
    };
  };
};
