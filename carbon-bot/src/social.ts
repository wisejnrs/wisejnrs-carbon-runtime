// Social posting via official APIs only:
//  - LinkedIn: Share on LinkedIn (ugcPosts) with optional image upload
//  - Instagram: Graph API two-step publish (business/creator accounts)
// Tokens live in .env; see SETUP-social.md for the one-time app setup.

const LINKEDIN_API = 'https://api.linkedin.com/v2';
const GRAPH_API = 'https://graph.facebook.com/v21.0';

export function linkedinConfigured(): boolean {
  return Boolean(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN);
}

export function instagramConfigured(): boolean {
  return Boolean(process.env.INSTAGRAM_USER_ID && process.env.INSTAGRAM_ACCESS_TOKEN);
}

async function linkedinFetch(path: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${LINKEDIN_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`LinkedIn ${path} failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  }
  const id = response.headers.get('x-restli-id');
  const data = response.status === 201 && !response.headers.get('content-length')
    ? {}
    : ((await response.json().catch(() => ({}))) as Record<string, unknown>);
  if (id) data.__id = id;
  return data;
}

export async function postToLinkedIn(text: string, image?: Buffer): Promise<string> {
  const author = process.env.LINKEDIN_AUTHOR_URN!;
  let media: Array<Record<string, unknown>> | undefined;

  if (image) {
    const register = (await linkedinFetch('/assets?action=registerUpload', {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: author,
        serviceRelationships: [
          { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
        ],
      },
    })) as {
      value?: {
        asset: string;
        uploadMechanism: Record<string, { uploadUrl: string }>;
      };
    };
    const upload = register.value?.uploadMechanism?.[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ];
    if (!upload || !register.value) throw new Error('LinkedIn upload registration failed');
    const putResponse = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}` },
      body: new Uint8Array(image),
    });
    if (!putResponse.ok) throw new Error(`LinkedIn image upload failed (${putResponse.status})`);
    media = [{ status: 'READY', media: register.value.asset }];
  }

  const post = await linkedinFetch('/ugcPosts', {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: text.slice(0, 3000) },
        shareMediaCategory: media ? 'IMAGE' : 'NONE',
        ...(media ? { media } : {}),
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  });
  const id = String(post.__id ?? post.id ?? '');
  return id ? `https://www.linkedin.com/feed/update/${id}` : 'posted (no id returned)';
}

export async function postToInstagram(caption: string, imageUrl: string): Promise<string> {
  const igUser = process.env.INSTAGRAM_USER_ID!;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN!;

  const createResponse = await fetch(
    `${GRAPH_API}/${igUser}/media?` +
      new URLSearchParams({ image_url: imageUrl, caption: caption.slice(0, 2200), access_token: token }),
    { method: 'POST' },
  );
  const created = (await createResponse.json()) as { id?: string; error?: { message: string } };
  if (!created.id) throw new Error(`Instagram media create failed: ${created.error?.message ?? 'unknown'}`);

  // The container can take a few seconds to process before it is publishable.
  for (let attempt = 0; attempt < 10; attempt++) {
    const publishResponse = await fetch(
      `${GRAPH_API}/${igUser}/media_publish?` +
        new URLSearchParams({ creation_id: created.id, access_token: token }),
      { method: 'POST' },
    );
    const published = (await publishResponse.json()) as {
      id?: string;
      error?: { message: string; code?: number };
    };
    if (published.id) {
      const link = await fetch(
        `${GRAPH_API}/${published.id}?fields=permalink&access_token=${token}`,
      ).then((r) => r.json() as Promise<{ permalink?: string }>).catch(() => ({}) as { permalink?: string });
      return link.permalink ?? `published (media id ${published.id})`;
    }
    if (published.error?.code !== 9007) {
      // 9007 = media not ready yet; anything else is a real failure
      throw new Error(`Instagram publish failed: ${published.error?.message ?? 'unknown'}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('Instagram publish timed out waiting for media processing');
}
