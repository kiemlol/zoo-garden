/** Shared solo/server balance: seconds, metres and multiples of attack. */
export const SORCERER={
 mandala:{hits:5,gap:.1,range:3.4,power:.46,discRange:16,discSpeed:22,discPower:1.1},
 portal:{time:2.5,bonus:.3,ambush:1},
 bands:{time:4,radius:4.5,root:2.5,power:.75,tick:1},
 meteor:{range:16,flight:.65,fall:.65,radius:4.5,power:3.4,stun:1.5},
} as const;
export const SORCERER_LOOKS=['mandala','mandala-disc','veil-portal','veil-exit','crimson-bands','meteor-gate','meteor-impact'] as const;
export const SORCERER_SKILLS=[
 {name:'Mandala Discs',icon:'☀️',cd:3,description:'Five rapid strikes with orange spell discs. The last hit launches a disc that pierces every enemy along a 16 m line.'},
 {name:'Concealment Portal',icon:'🌀',cd:12,description:'Enter a stationary fire portal and disappear for 2.5 s. Enemies lose you and attacks miss. Press again to exit early from the same portal. Deal 30% more damage for 1 s after exiting.'},
 {name:'Crimson Bands of Cyttorak',icon:'🎗️',cd:9,description:'Red magical bands surround your position for 4 s, damaging enemies each second. Each enemy entering the 4.5 m area is rooted for 2.5 s.'},
 {name:'Meteor Portal',icon:'☄️',cd:10,description:'Lob a sling ring up to 16 m. A portal above its landing point drops meteors, exploding within 4.5 m and stunning for 1.5 s.'},
];
