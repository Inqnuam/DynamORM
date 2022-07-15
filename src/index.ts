import { Players } from "./models/players";
const newPlayer = {
  firstname: "  Serena",
  lastname: "williams",
  age: 8,
  sex: "F",
  isNew: true,
  oooooooooo: "invalid field",
  data: {
    anotherTrimmableFields: "      Hello World     ",
    nested: {
      bobo: {
        toto: {
          lolo: 8,
        },
      },
      dontTakeme: "im sad :(",
    },
    rank: 3,
    // country: "SPA",
    // points: 23423,
    // weight: 1500,
    // height: 180,
    last: [1, 0, 1],
  },
  last: 7,
  resultsBySport: {
    tennis: 6,
    thisAsAn: "Undeclared field!!!",
  },
};

Players.on("ready", async () => {
  try {
    // CREATE
    const createdPlayer = await Players.create(newPlayer, { returnCreated: true, applyVirtualSetters: true });
    const playerId = createdPlayer.Item.id;

    // GET
    const selectAsString = undefined; //"firstname, lastname, data.rank, data.last, fullname";
    // const selectWithAlias = {
    //   id: "uuid",
    //   firstname: true,
    //   lastname: "nom de famille",
    //   "data:playerData": { anotherTrimmableFields: true, rank: true, last: "games", "nested:deep": { bobo: "je ne suis plus bobo" } },
    //   fullname: true,
    //   score_global: "RESULTaaass",
    // };

    // const gettingId = "d5362382-faa7-42dc-89d4-814045836cec";
    Players.getByPk(playerId, selectAsString).then((resonse) => {
      console.log("RECEIVED :)", resonse);
    });

    // UPDATE
    const updatingId = "d5362382-faa7-42dc-89d4-814045836cec";

    const updatingDoc = {
      firstname: "Blabla",
      lastname: "Yooo",
      data: {
        "last[0]": {
          $incr: 1,
        },
        "last[1]": 777,
        // last: {
        //   $push: [89],
        //   // $unshift: [1656545, 853445],
        //   //$pull: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        // },
        // nested: {
        //   $set: {
        //     game: "over",
        //   },
        // },
        //$delete: "rank",
        //  rank: { $incr: 1 }, // before 3
      },
      //  last: { $decr: 2 }, // before 15
    };

    const testTopLevel = {
      // $remove: ["firstname"],

      data: {
        last: [1, 1, 1, 1, 1, 2, 3, 4],
      },
      $set: {
        firstname: "Serena",
      },
    };

    //  ConditionExpression
    // ça marche !!
    // const conditions = {
    //   $or: [{ firstname: "wrongName" }, { data: { "last[0]": { $eq: 1 } } }],
    // };

    // ça marche aussi !!
    // const conditions = {
    //   $or: [{ firstname: "wrongName" }, { data: { "last[0]": 1 } }],
    // };

    // ça marche aussi !!
    // const conditions = {
    //   $or: [{ firstname: "wrongName" }, { data: { malakan: { mooooo: "yojooo" } } }],
    // };

    // ça marche aussi !!
    // const conditions = {
    //   $or: [{ firstname: "wrongName" }, { data: { malakan: { mooooo: { $eq: "yojooo" } } } }],
    // };

    // ça marche aussi !!
    // const conditions = {
    //   $or: [{ firstname: "wrongName" }, { "data.malakan.mooooo": { $eq: "yojooo" } }],
    // };

    // ça marche aussi !!
    // const conditions = {
    //   $or: [{ firstname: "wrongName" }, { "data.malakan.mooooo": "yojooo" }],
    // };

    // ça marche aussi !!
    // const conditions = {
    //   $or: [
    //     { firstname: "Novakkk" },
    //     { bobo: { $exists: true } },
    //     { firstname: { $contains: "Nooooov" } },
    //     {
    //       data: {
    //         "last[1]": {
    //           $gt: 0,
    //         },
    //       },
    //     },
    //     {
    //       data: {
    //         $and: [{ "malakan.mooooo": "yojooo" }, { awsomeField: { $eq: "awsomeValue!!" } }, { himar: { $exists: true } }],
    //       },
    //     },
    //   ],
    // };

    // ça marche !! considered as AND condition as no operator is provied at top level
    // const conditions = {
    //   firstname: "Novak",
    //   $or: [{ data: { malakan: { mooooo: { $startsWith: "yo" } } } }, { sex: "M" }],
    // };

    //

    // const last = [1, 1, 1, 1, 1, 2, 3, 4, 1, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9];

    // const conditions = {
    //   firstname: "Novak",
    //   data: {
    //     last: {
    //       $eq: last,
    //       "[0]": {
    //         $lt: 4,
    //       },
    //     },
    //   },
    // };

    // ça marche
    // const conditions = {
    //   $not: {
    //     firstname: "Novak",
    //     lastname: "Bibarr",
    //   },
    // };

    // ça marche
    // const conditions = {
    //   data: {
    //     last: {
    //       "[1]": {
    //         $between: [3, 8],
    //       },
    //     },
    //   },
    // };
    // const updatedPlayer = await Players.update(
    //   updatingId,
    //   {
    //     lastname: "Djokovic",
    //   },
    //   conditions
    // );
    // console.log(updatedPlayer.Attributes);
  } catch (error) {
    console.log("ERROR :(");
    console.error(error);
  }
});
