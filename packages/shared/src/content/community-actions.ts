export type CommunityActionId = 'browse' | 'claim' | 'contribute' | 'submit' | 'organizer';

export type CommunityActionCopy = {
  id: CommunityActionId;
  title: string;
  audience: string;
  body: string;
  cta: string;
  href?: string;
};

export const COMMUNITY_ACTIONS: Record<CommunityActionId, CommunityActionCopy> = {
  browse: {
    id: 'browse',
    title: 'I just want to find a community',
    audience: 'Visitors',
    body: 'Start from city pages to browse communities and events near you.',
    cta: 'Open the home page',
    href: '/',
  },
  claim: {
    id: 'claim',
    title: 'I run this community',
    audience: 'Organizers',
    body: 'Claim an existing listing if you are the organizer, founder, or admin and want to manage profile details and events.',
    cta: 'Claim a listed community',
    href: '/organizer/login',
  },
  contribute: {
    id: 'contribute',
    title: 'This community or resource is missing',
    audience: 'Community members',
    body: 'Use contribute when something should exist on IndLokal but is not listed yet.',
    cta: 'Open a city page to contribute it',
  },
  submit: {
    id: 'submit',
    title: 'Add a brand-new community',
    audience: 'Founders and members',
    body: 'Submit a new listing when you are adding a community to IndLokal for the first time.',
    cta: 'Submit a community',
    href: '/submit',
  },
  organizer: {
    id: 'organizer',
    title: 'I already have access',
    audience: 'Approved organizers',
    body: 'Open organizer access after your claim is approved to edit profile details, manage join links, and add events.',
    cta: 'Open organizer login',
    href: '/organizer/login',
  },
};

export const ACTION_GRID_ORDER: CommunityActionId[] = [
  'browse',
  'claim',
  'contribute',
  'submit',
  'organizer',
];

export const COMMUNITY_ACTION_COPY = {
  aboutDescription:
    'Use this guide when you are not sure whether to browse, contribute, submit, or claim. Rule of thumb: if you run the community, claim it. If it is missing, contribute it. If you are adding a brand-new listing, submit it.',
  claimSectionLead:
    'Claim it if you are the organizer, founder, or admin. After approval, you can manage the profile, join links, and events for this listing.',
  claimSectionHint:
    'If this community is not listed yet, use the contribute flow instead. Claiming is for existing listings that you already help run.',
  contributePageLead:
    'Use this when something should be in IndLokal but is not listed yet. If you run the community yourself, open its page and claim it instead.',
  contributeWho:
    'People who know of a community, service, or useful resource in {{city}} that is missing from IndLokal. You do not need ownership to send a contribution.',
  submitPageLead:
    'Use this when the community is not listed yet. If it already exists, claim it instead. If you are only pointing us to a missing group or resource, use Contribute instead.',
  submitWho:
    'People adding a new community for the first time. The submission is reviewed before it goes live, so visitors see a clear and active listing rather than a duplicate or incomplete page.',
  submitFormHint: 'Use this form when the community is not listed yet.',
  submitFormBody:
    'If the community already exists on IndLokal, claim it instead. If you are only telling us about a missing group or resource, use the contribute flow on your city page.',
  organizerLoginBody:
    'Once your claim is approved, this is where you edit the community profile, manage join links, and add events. If you do not manage a listed community yet, start by claiming it on the community page or by submitting a new listing.',
  organizerDashboardBody:
    'This dashboard is for approved organizers - the person or team that runs the community listing. Here you can edit the profile, manage join links, and post events that appear on the city feed.',
  mobileSubmitChooserSub: 'Submissions are reviewed before going live.',
  mobileSubmitCommunityHint:
    'Use this when the community is not listed yet. If it already exists, claim it on the web page instead. If you only want to point us to something missing, use Contribute.',
  mobileSubmitContributeHint:
    'Use this when a community, service, or resource should be listed but is missing from IndLokal. You do not need to manage it yourself.',
} as const;

export function interpolateActionCopy(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? '');
}
