import { expect } from "@std/expect/expect";
import { beforeEach, describe, test } from "@std/testing/bdd";
import { } from "@std/testing/mock";
import { } from "@std/testing/unstable-bdd";

import { Low, Memory } from "lowdb";
import type { JsonObject } from "type-fest";

import { assertEquals } from "@std/assert/equals";
import { assertNotEquals } from "@std/assert/not-equals";
import type { Data } from "./service.ts";
import { Service } from "./service.ts";

const defaultData = { posts: [], comments: [], object: {} };
const adapter = new Memory<Data>();
const db = new Low<Data>(adapter, defaultData);
const service = new Service(db);

const POSTS = "posts";
const COMMENTS = "comments";
const OBJECT = "object";

const UNKNOWN_RESOURCE = "xxx";
const UNKNOWN_ID = "xxx";

const post1 = {
  id: "1",
  title: "a",
  views: 100,
  published: true,
  author: { name: "foo" },
  tags: ["foo", "bar"],
};
const post2 = {
  id: "2",
  title: "b",
  views: 200,
  published: false,
  author: { name: "bar" },
  tags: ["bar"],
};
const post3 = {
  id: "3",
  title: "c",
  views: 300,
  published: false,
  author: { name: "baz" },
  tags: ["foo"],
};
const comment1 = { id: "1", title: "a", postId: "1" };
const obj = {
  f1: "foo",
};

beforeEach(() => {
  db.data = structuredClone({
    posts: [post1, post2, post3],
    comments: [comment1],
    object: obj,
  });
});

test("findById", () => {
  const posts = db.data?.[POSTS] ?? [];
  const firstPost = Array.isArray(posts) ? posts[0] : posts;
  const cases: [[string, string, { _embed?: string[] | string }], unknown][] = [
    [[POSTS, "1", {}], firstPost],
    [[POSTS, UNKNOWN_ID, {}], undefined],
    [[POSTS, "1", { _embed: ["comments"] }], {
      ...post1,
      comments: [comment1],
    }],
    [[COMMENTS, "1", { _embed: ["post"] }], { ...comment1, post: post1 }],
    [[UNKNOWN_RESOURCE, "1", {}], undefined],
  ];

  for (const [[name, id, query], expected] of cases) {
    assertEquals(service.findById(name, id, query), expected);
  }
});

describe("find", () => {
  const whereFromPayload = JSON.parse(
    '{"author":{"name":{"eq":"bar"}}}',
  ) as JsonObject;

  const cases: [
    { where: JsonObject; sort?: string; page?: number; perPage?: number },
    unknown,
  ][] = [
    [{ where: { title: { eq: "b" } } }, [post2]],
    [{ where: whereFromPayload }, [post2]],
    [{ where: {}, sort: "-views" }, [post3, post2, post1]],
    [
      { where: {}, page: 2, perPage: 2 },
      {
        first: 1,
        prev: 1,
        next: null,
        last: 2,
        pages: 2,
        items: 3,
        data: [post3],
      },
    ],
  ];

  for (const [opts, expected] of cases) {
    test(JSON.stringify(opts), () => {
      assertEquals(service.find(POSTS, opts), expected);
    });
  }
});

test("create", async () => {
  const post = { title: "new post" };
  let res = await service.create(POSTS, post);
  assertEquals(res?.["title"], post.title);
  assertEquals(typeof res?.["id"], "string", "id should be a string");

  res = await service.create(POSTS, { ...post, id: "foo" });
  assertNotEquals(res?.["id"], "foo", "user should not be able to set id");

  assertEquals(await service.create(UNKNOWN_RESOURCE, post), undefined);
});

test("update", async () => {
  const obj = { f1: "bar" };
  const res = await service.update(OBJECT, obj);
  assertEquals(res, obj);

  assertEquals(
    await service.update(UNKNOWN_RESOURCE, obj),
    undefined,
    "should ignore unknown resources",
  );
  assertEquals(
    await service.update(POSTS, {}),
    undefined,
    "should ignore arrays",
  );
});

test("patch", async () => {
  const obj = { f2: "bar" };
  const res = await service.patch(OBJECT, obj);
  assertEquals(res, { f1: "foo", ...obj });

  assertEquals(
    await service.patch(UNKNOWN_RESOURCE, obj),
    undefined,
    "should ignore unknown resources",
  );
  assertEquals(
    await service.patch(POSTS, {}),
    undefined,
    "should ignore arrays",
  );
});

test("updateById", async () => {
  const post = { id: "xxx", title: "updated post" };
  const res = await service.updateById(POSTS, post1.id, post);
  assertEquals(res?.["id"], post1.id, "id should not change");
  assertEquals(res?.["title"], post.title);

  assertEquals(
    await service.updateById(UNKNOWN_RESOURCE, post1.id, post),
    undefined,
  );
  assertEquals(await service.updateById(POSTS, UNKNOWN_ID, post), undefined);
});

test("patchById", async () => {
  const post = { id: "xxx", title: "updated post" };
  const res = await service.patchById(POSTS, post1.id, post);
  assertNotEquals(res, undefined);
  assertEquals(res?.["id"], post1.id);
  assertEquals(res?.["title"], post.title);

  assertEquals(
    await service.patchById(UNKNOWN_RESOURCE, post1.id, post),
    undefined,
  );
  assertEquals(await service.patchById(POSTS, UNKNOWN_ID, post), undefined);
});

describe("destroy", () => {
  test("nullifies foreign keys", async () => {
    const prevLength = Number(db.data?.[POSTS]?.length) || 0;

    await service.destroyById(POSTS, post1.id);

    expect(db.data).toBeTruthy();
    expect(db.data[POSTS]).toHaveLength(prevLength - 1);
    expect(db.data[COMMENTS]).toEqual([{ ...comment1, postId: null }]);
  });

  test("deletes dependent resources", async () => {
    const prevLength = Number(db.data?.[POSTS]?.length) || 0;

    await service.destroyById(POSTS, post1.id, [COMMENTS]);

    expect(db.data[POSTS]).toHaveLength(prevLength - 1);
    expect(db.data[COMMENTS]).toHaveLength(0);
  });

  test("ignores unknown resources", async () => {
    expect(await service.destroyById(UNKNOWN_RESOURCE, UNKNOWN_ID)).toBeUndefined();
    expect(await service.destroyById(UNKNOWN_RESOURCE, post1.id)).toBeUndefined();
    expect(await service.destroyById(POSTS, UNKNOWN_ID)).toBeUndefined();
  });
});
