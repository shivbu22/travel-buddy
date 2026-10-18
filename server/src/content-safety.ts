import { BadRequestException } from '@nestjs/common';

// This is a first-pass server boundary for public text and chat. Reports remain
// the source of truth for human review; this filter is deliberately conservative
// and is not presented as automated moderation.
const disallowed = [
  /\bchild(?:ren)?\s*(?:porn|sexual|sex|nude|naked|exploitation)\b/i,
  /\b(?:incest|rape|sexual\s+assault|human\s+traffick(?:ing|er))\b/i,
  /\b(?:kill|murder|bomb|terror(?:ist|ism))\s+(?:you|him|her|them|people|everyone)\b/i,
  /\b(?:send|share)\s+(?:nudes?|explicit|sexual)\b/i,
  /\b(?:blowjob|handjob|deepthroat|cum|dick|pussy|porn)\b/i,
];

export function containsDisallowedContent(value: string) {
  return disallowed.some((pattern) => pattern.test(value));
}

export function assertSafeUserText(value: string, field = 'content') {
  if (containsDisallowedContent(value)) throw new BadRequestException(`That ${field} cannot be posted. Remove sexual, exploitative, or threatening content and try again.`);
}
