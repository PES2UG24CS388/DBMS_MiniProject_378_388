// Run with:  mongosh "mongodb://localhost:27017" mongo/init.js
// Creates the NoSQL side of the project: rich access/login events.
const d = db.getSiblingDB('rbac_audit');
d.access_events.drop();

d.createCollection('access_events', {
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['type', 'ts'],
    properties: {
      type:     { enum: ['ACCESS_CHECK', 'LOGIN_SUCCESS', 'LOGIN_FAILURE'] },
      ts:       { bsonType: 'date' },
      userId:   { bsonType: ['int', 'long', 'double', 'null'] },
      username: { bsonType: 'string' },
      action:   { bsonType: 'string' },
      resource: { bsonType: 'string' },
      decision: { enum: ['ALLOW', 'DENY'] },
      ip:       { bsonType: 'string' },
      context:  { bsonType: 'object' }
    }
  } },
  validationAction: 'error'
});

d.access_events.createIndex({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 }); // TTL: 180 days
d.access_events.createIndex({ type: 1, ts: -1 });
d.access_events.createIndex({ userId: 1, ts: -1 });
d.access_events.createIndex({ resource: 1, decision: 1 });

// Demo data: ~300 access checks over the last 7 days + a brute-force burst
const users = [[1,'admin'],[2,'auditor1'],[3,'manager1'],[4,'hr1'],[5,'emp1'],[6,'emp2']];
const probes = [
  ['READ','profile'],['READ','audit_log'],['READ','payroll'],['UPDATE','payroll'],
  ['EXPORT','report'],['READ','report'],['ARCHIVE','audit_log'],['READ','user']
];
const docs = [];
for (let i = 0; i < 300; i++) {
  const [uid, name] = users[Math.floor(Math.random() * users.length)];
  const [action, resource] = probes[Math.floor(Math.random() * probes.length)];
  const lowPriv = uid >= 5;
  const deny = lowPriv ? Math.random() < 0.7 : Math.random() < 0.15;
  docs.push({
    type: 'ACCESS_CHECK', ts: new Date(Date.now() - Math.random() * 7 * 864e5),
    userId: uid, username: name, action, resource,
    decision: deny ? 'DENY' : 'ALLOW', ip: '10.0.' + (uid % 3) + '.' + (10 + uid),
    context: { userAgent: 'seed', matchedRules: deny ? [{ ruleId: 2, effect: 'DENY' }] : [] }
  });
}
for (let i = 0; i < 6; i++) {
  docs.push({ type: 'LOGIN_FAILURE', ts: new Date(Date.now() - i * 600e3),
              username: 'admin', ip: '203.0.113.9', context: { reason: 'bad password' } });
}
d.access_events.insertMany(docs);
print('access_events ready: ' + d.access_events.countDocuments() + ' documents');
