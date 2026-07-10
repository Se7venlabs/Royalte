# ROYALTĒ BOARD API CAPABILITIES REPORT

**Version:** 1.0  
**Date:** 2026-06-24  
**Prepared for:** Board of Directors  
**Classification:** Internal — Board Reference

---

**Purpose:** This document answers one question per integration: *What does this API give Royaltē?*

No interpretation. No implementation detail. No code. Simply the complete data available from each API.

---

## Apple Music

What does Apple Music give Royaltē?

**Artist**
- Artist Name
- Apple Artist ID
- Artist URL (Apple Music link)
- Artist Artwork (scalable, any resolution)
- Genres (array)
- Editorial Notes (short and standard)
- Biography text
- Origin (not always present)

**Albums / EPs / Singles**
- Title
- Album Type (album, EP, single, compilation)
- Artist Name
- Release Date (full date)
- Record Label
- Copyright Notice
- UPC / Barcode
- Track Count
- Artwork (scalable, any resolution)
- Content Rating (explicit, clean, not explicit)
- Is Mastered for iTunes (boolean)
- Is Single (boolean)
- Is Compilation (boolean)
- Genres (array)
- Editorial Notes
- Apple Music URL
- Playback Parameters

**Songs / Tracks**
- Title
- ISRC
- Artist Name
- Album Name
- Track Number
- Disc Number
- Duration (milliseconds)
- Release Date
- Genre (array)
- Content Rating (explicit, clean, not explicit)
- Composer Name (when available)
- Has Lyrics (boolean)
- Is Apple Digital Master (boolean)
- Preview URL (30-second audio clip)
- Artwork (inherited from album)
- Apple Music URL
- Playback Parameters

**Music Videos**
- Title
- ISRC
- Artist Name
- Duration (milliseconds)
- Release Date
- Genre (array)
- Content Rating
- Preview URL
- Artwork
- Video Type
- Apple Music URL

**Global Availability**
- Availability status per Apple Music storefront (167 markets)
- List of markets where catalog is available
- List of markets where catalog is unavailable
- BIG6 key market availability: US, GB, CA, AU, DE, FR, JP, MX

**Additional**
- Playlists featuring the artist (editorial)
- Stations associated with the artist
- Related artists
- Similar artists

---

## Spotify

What does Spotify give Royaltē?

**Artist**
- Artist Name
- Spotify Artist ID
- Spotify Artist URL
- Follower Count
- Popularity Score (0–100, Spotify-calculated)
- Genres (array, Spotify-assigned)
- Artist Images (3 sizes)
- Artist Profile URL

**Albums**
- Title
- Spotify Album ID
- Album Type (album, single, compilation)
- Artist(s)
- Release Date (full date or year-only)
- Release Date Precision (day, month, year)
- Total Track Count
- Available Markets (countries where the album is accessible)
- Artwork Images (3 sizes)
- External URLs (Spotify link)
- Record Label
- Copyright Notices (array — C and P rights)
- UPC / Barcode
- Genres (when populated)
- Popularity Score
- Album Group Classification (album, single, appears\_on, compilation)

**Tracks**
- Title
- Spotify Track ID
- ISRC
- Track Number
- Disc Number
- Duration (milliseconds)
- Explicit (boolean)
- Popularity Score (0–100)
- Preview URL (30-second audio clip)
- Available Markets
- Is Playable (boolean)
- Linked From (if track is relinked)
- Artist(s)
- Album (name, ID, artwork, release date)
- External URLs (Spotify link)

**Audio Features (per track)**
- Danceability (0.0–1.0)
- Energy (0.0–1.0)
- Key (0–11, Pitch Class notation)
- Loudness (dB)
- Mode (major or minor)
- Speechiness (0.0–1.0)
- Acousticness (0.0–1.0)
- Instrumentalness (0.0–1.0)
- Liveness (0.0–1.0)
- Valence / Mood (0.0–1.0)
- Tempo (BPM)
- Time Signature
- Duration (milliseconds)

**Features / Collaborations**
- Albums where artist appears as featured contributor (appears\_on count)
- Album details for each appears\_on entry

**Top Tracks**
- Up to 10 top tracks by market
- All track fields as listed above

**Additional**
- Related artists (up to 20 similar artists with full artist profiles)
- Artist's discography with pagination (albums, singles, compilations separately)

---

## MLC (Mechanical Licensing Collective)

What does MLC give Royaltē?

**Artist / Rights Holder**
- Artist registration status in the MLC database
- IPI Number (Interested Party Information — unique composer/publisher identifier)
- Legal name as registered
- PRO affiliation as declared to MLC

**Musical Works (Compositions)**
- Work Title
- ISWC (International Standard Musical Work Code)
- Co-writer names
- Co-writer IPI numbers
- Publisher name(s)
- Publisher IPI number(s)
- Publisher share percentage(s)
- Writer share percentage(s)
- Territory coverage per work
- Registration date
- Work status (active, disputed, etc.)

**Counts / Aggregates**
- Total number of registered works
- Total number of ISWC-coded works
- Total number of distinct publishers administering rights
- Total number of co-writers per work

---

## MusicBrainz

What does MusicBrainz give Royaltē?

**Artist**
- MusicBrainz Artist ID (MBID — permanent UUID)
- Official Name
- Sort Name (Last, First format)
- Artist Type (Person, Group, Orchestra, Choir, Character, Other)
- Gender
- Area (country or region)
- Begin Area (where career or life began)
- Life Span (begin date, end date, ended boolean)
- Country of Origin
- Disambiguation Note (distinguishes artists with same name)
- Aliases (all known alternate names and spellings)
- Tags (community-assigned genre and style tags)
- Genres (community-assigned)
- Rating (community rating)
- ISNI Numbers (International Standard Name Identifier — array)
- IPI Numbers (Interested Party Information — array)
- External Links (Wikipedia, Wikidata, official website, Discogs, AllMusic, IMDb, etc.)

**Releases / Albums**
- Release Title
- MusicBrainz Release ID (MBID)
- Release Group ID (links different editions of the same album)
- Release Date (full date)
- Country of Release
- Barcode (EAN/UPC)
- Status (Official, Promotional, Bootleg, Pseudo-Release)
- Packaging Type
- Label(s) and catalog number(s)
- Language
- Script
- Disambiguation Note
- Media (disc count, format per disc)
- Track listing per disc

**Recordings**
- Recording Title
- MusicBrainz Recording ID (MBID)
- Length (milliseconds)
- ISRC(s) — can be multiple per recording
- Artist Credit
- Release associations

**Works (Compositions)**
- Work Title
- MusicBrainz Work ID (MBID)
- ISWC(s)
- Work Type (Song, Aria, Concerto, etc.)
- Language
- Attributes (cover, medley, etc.)
- Related works (arrangements, translations, etc.)
- Writers (via relationships)
- Publishers (via relationships)

**Labels**
- Label Name
- MusicBrainz Label ID
- Label Type (Original Production, Reissue Production, Bootleg Production, etc.)
- Label Code
- Country
- IPI Numbers

**Additional**
- Series memberships
- Event appearances
- Place associations
- Instrument credits
- Relationship network between artists, works, recordings, releases, and labels

---

## Discogs

What does Discogs give Royaltē?

**Artist**
- Discogs Artist ID
- Primary Name
- Name Variations (all alternate names, spellings, abbreviations)
- Real Name (legal name when different from artist name)
- Profile / Biography (community-written)
- Members (for groups — individual member names and links)
- Groups (for individuals — group memberships)
- Aliases (other artist identities held by the same person/group)
- URLs (official website, social media, etc.)
- Images (primary photo + additional photos)
- Data Quality Rating

**Releases**
- Release Title
- Discogs Release ID
- Artist(s)
- Year
- Country of Release
- Label(s)
- Catalog Number(s)
- Formats (Vinyl, CD, Cassette, Digital, etc.) with descriptions (LP, 12", 7", etc.)
- Genres (array)
- Styles (array — more specific than genre)
- Tracklist (title, position, duration per track)
- Notes / Credits
- Companies (distributors, manufacturers, publishers, etc.)
- Identifiers (barcode, matrix/runout, ASIN, etc.)
- Videos (YouTube links associated with release)
- Images (front cover, back cover, label scans, etc.)
- Community Data (have count, want count, rating, rating count)
- Data Quality Rating
- Master Release link

**Master Releases**
- Master Title
- Main Release (primary version)
- Most Recent Release
- Year of first release
- Genres
- Styles
- Artists
- Tracklist
- Images
- Videos
- Number of versions

**Marketplace Data** *(requires additional auth)*
- Lowest price
- Number of items for sale
- Condition grades available

---

## Deezer

What does Deezer give Royaltē?

*Verified 2026-06-24 against live API using Black Alternative (ID: 3215321). All fields listed below are confirmed from actual API responses. Auth: none required (public API). Rate limit: 50 requests / 5 seconds per IP.*

---

### Endpoint: `GET /search/artist?q={name}&limit=N`

Returns a list of artist search candidates. Fields per candidate:

- Deezer Artist ID
- Artist Name
- Deezer Profile URL (`link`)
- Artist Picture — 5 sizes: `picture` (redirect), `picture_small` (56×56), `picture_medium` (250×250), `picture_big` (500×500), `picture_xl` (1000×1000)
- Number of Albums (`nb_album`)
- Number of Fans (`nb_fan`)
- Radio Available (boolean)
- Tracklist URL (pointer to artist top tracks)
- Type identifier (`"artist"`)

*Note: `share` (UTM-tagged share URL) is NOT included in search results — only in artist detail.*

---

### Endpoint: `GET /artist/{id}`

Full artist profile. Returns all fields from search, plus:

- Share URL (UTM-tagged link for social sharing)

*Observation: Artist detail returns the same fields as search results, plus `share`. No biography, genre tags, or social links are returned at the artist level — genres are only derivable from the artist's albums.*

---

### Endpoint: `GET /artist/{id}/albums?limit=N`

Returns the artist's release list. Fields per album entry:

- Deezer Album ID
- Title
- Deezer Album URL (`link`)
- Cover Art — 4 sizes: `cover` (redirect), `cover_small` (56×56), `cover_medium` (250×250), `cover_big` (500×500), `cover_xl` (1000×1000)
- Cover MD5 Hash (`md5_image`) — CDN image deduplication key
- Genre ID (primary genre, integer)
- Fan Count (`fans`) — per-album fan count
- Release Date (full date: `YYYY-MM-DD`)
- Record Type (`"album"`, `"single"`, `"ep"`)
- Tracklist URL (pointer to album tracks)
- Explicit Lyrics (boolean)
- Type identifier (`"album"`)

**Fields NOT available from the list endpoint** *(require individual `/album/{id}` fetch)*:
- UPC / Barcode
- Share URL
- Genres array (named genre objects with id, name, picture)
- Record Label
- Number of Tracks (`nb_tracks`)
- Total Duration (seconds)
- Available (boolean — whether album is streamable)
- Explicit Content Lyrics rating (integer)
- Explicit Content Cover rating (integer)
- Contributors array (artists with roles)
- Embedded artist object
- Embedded tracks list

---

### Endpoint: `GET /album/{id}`

Full album detail. Returns all list fields, plus:

- UPC / Barcode (`upc`) — *only available here, not in album list*
- Share URL (UTM-tagged)
- Genres — array of genre objects, each with: `id`, `name`, `picture` URL, `type`
- Record Label (`label`) — *only available here, not in album list*
- Number of Tracks (`nb_tracks`)
- Total Duration in seconds (`duration`)
- Available (boolean — whether album is currently streamable)
- Explicit Content Lyrics (integer rating: 0=none, 1=explicit, 2=unknown)
- Explicit Content Cover (integer rating: 0=none, 1=explicit, 2=unknown)
- Contributors — array of contributing artists, each with: `id`, `name`, `link`, `share`, `picture` (5 sizes), `radio`, `tracklist`, `type`, **`role`** (e.g., `"Main"`, `"Featured"`, `"Composer"`)
- Artist — embedded artist object (id, name, picture × 5, tracklist, type)
- Tracks — embedded tracklist, each track with: `id`, `readable`, `title`, `title_short`, `title_version`, `link`, `duration`, `rank`, `explicit_lyrics`, `explicit_content_lyrics`, `explicit_content_cover`, `preview`, `md5_image`, `artist`, `album`, `type`

*Note: ISRC is NOT present in the embedded tracks list inside `/album/{id}`. ISRC requires `/album/{id}/tracks` or `/track/{id}`.*

---

### Endpoint: `GET /album/{id}/tracks`

Album tracklist with ISRC. Fields per track:

- Deezer Track ID
- Readable (boolean — playable in current region)
- Title (full)
- Title Short
- Title Version (e.g., `"feat. Someone"`, `"Radio Edit"`)
- **ISRC** — present here, absent from the embedded tracks in `/album/{id}`
- Deezer Track URL (`link`)
- Duration (seconds)
- Track Position
- Disc Number
- Rank (Deezer popularity integer — higher = more popular)
- Explicit Lyrics (boolean)
- Explicit Content Lyrics (integer rating)
- Explicit Content Cover (integer rating)
- Preview URL (30-second audio clip, time-limited CDN URL)
- Cover MD5 Hash (`md5_image`)
- Artist — embedded object (id, name, tracklist, type)
- Type identifier (`"track"`)

**Fields NOT available from this endpoint** *(require individual `/track/{id}` fetch)*:
- Share URL
- Release Date
- BPM
- Gain (audio normalization value, float)
- Available Countries (territory list)
- Contributors array with roles
- Track Token (playback token)
- Embedded album object with full details

---

### Endpoint: `GET /track/{id}`

Full track detail — the most complete track data available. Returns all album-track fields, plus:

- Share URL (UTM-tagged)
- Release Date (`YYYY-MM-DD`)
- BPM (beats per minute, float — returns `0` when not measured)
- Gain (audio normalization float, e.g., `-8.2` dB)
- **Available Countries** — full array of ISO 3166-1 alpha-2 country codes where the track is licensed (e.g., `["AE", "AF", "AG", ... "ZW"]`) — *this is Deezer's per-track territory distribution data*
- Contributors — full array with: `id`, `name`, `link`, `share`, `picture` (5 sizes), `radio`, `tracklist`, `type`, **`role`** (`"Main"`, `"Featured"`, `"Composer"`, `"Lyricist"`, etc.)
- Track Token — time-limited JWT for stream initiation (expires; not for storage)
- Artist — full embedded artist object including `link` and `share`
- Album — embedded album object with `link`, cover (5 sizes), `release_date`, `tracklist`

*Observation: The Available Countries list for Black Alternative's "Everything Is Over" contained 185 country codes — near-global distribution coverage.*

---

### Endpoint: `GET /track/isrc:{isrc}`

ISRC direct lookup. Returns the identical full response as `/track/{id}`. This is a **direct rights verification tool**: given any ISRC from Apple Music or Spotify, Deezer can confirm whether that recording is distributed on Deezer and in which territories.

---

### Endpoint: `GET /artist/{id}/top?limit=N`

Artist's top tracks by Deezer rank. Returns same fields as `/album/{id}/tracks` (including ISRC, preview). Returns empty for artists with insufficient play history on Deezer.

---

### Endpoint: `GET /artist/{id}/playlists`

Editorial playlists featuring the artist. Returns error (`DataException code 800`) when no editorial playlists exist. When populated:

- Playlist ID
- Playlist Title
- Public (boolean)
- Number of Tracks
- Fan Count
- Picture (5 sizes)
- Tracklist URL
- Creation Date

---

### Endpoint: `GET /artist/{id}/radio`

Radio — curated tracks similar to the artist. Returns error (`DataException code 800`) for small or new artists. When populated, returns track list with same fields as `/artist/{id}/top`.

---

### Endpoint: `GET /artist/{id}/fans`

Fans who have followed the artist. Currently returns empty list even for established artists on the public API (likely restricted to authenticated user context). Shape: `{ data: [], total: 0 }`.

---

### Endpoint: `GET /artist/{id}/related`

Artists related to or similar to the queried artist. Currently returns empty for all tested artists on the public API. Shape: `{ data: [], total: 0 }`.

---

### Endpoint: `GET /genre`

Master genre list — 24 top-level genres. Fields per genre:

- Genre ID
- Genre Name
- Picture (5 sizes: `picture`, `picture_small`, `picture_medium`, `picture_big`, `picture_xl`)
- Type identifier (`"genre"`)

**Full genre taxonomy (24 genres):** All, Pop, Rap/Hip Hop, Rock, Dance, R&B, Alternative, Electro, Jazz, Films/Games, Country, Reggae, Classical, Folk, African Music, Metal, Christian Gospel, Podcasts, Soul & Funk, Chanson Française, Kids, New Age, Vocal & Easy Listening, Indie Pop

---

### Endpoint: `GET /genre/{id}`

Single genre detail. Returns same fields as the list.

---

### Endpoint: `GET /genre/{id}/artists`

Top artists in a genre (Deezer editorial picks). Fields per artist: same as `/search/artist` results.

---

### Endpoint: `GET /search?q={query}&limit=N`

General search (defaults to tracks). Fields per track result:

- Deezer Track ID
- Readable (boolean)
- Title (full)
- Title Short
- Title Version
- ISRC
- Deezer Link
- Duration (seconds)
- Rank
- Explicit Lyrics (boolean)
- Explicit Content Lyrics rating
- Explicit Content Cover rating
- Preview URL (30-second clip)
- MD5 Image hash
- Artist — embedded object (id, name, link, picture × 5, tracklist, type)
- Album — embedded object (id, title, cover × 5, md5_image, tracklist, type)
- Type identifier

---

### Endpoint: `GET /search/album?q={query}&limit=N`

Album-specific search. Fields per result:

- Deezer Album ID
- Title
- Deezer Link
- Cover Art (4 + redirect sizes)
- MD5 Image hash
- Genre ID
- Number of Tracks
- Record Type
- Tracklist URL
- Explicit Lyrics (boolean)
- Artist — embedded object (id, name, link, picture × 5, tracklist, type)
- Type identifier

---

### Fields Unique to Deezer

The following data points are available from Deezer and not from Apple Music or Spotify:

- **Deezer Rank** — an integer popularity score per track (higher = more plays on Deezer). Not equivalent to Spotify popularity; reflects Deezer-specific listener behavior.
- **Gain** — audio normalization value (dB float) per track. Indicates how loud/quiet the master recording is relative to a normalized target.
- **Track Token** — time-limited JWT for stream initiation. Not for storage; indicates a track is currently streamable.
- **Explicit Content Cover** — separate rating for whether the cover artwork is explicit (distinct from lyrics). Apple and Spotify only have a single explicit flag.
- **MD5 Image hash** — CDN image fingerprint enabling deduplication and cache validation across album and artist artwork.
- **Genre ID** per album — a primary integer genre tag directly on the album object, enabling genre classification without a separate lookup.
- **Per-track fan count at album level** — Deezer exposes a `fans` count per album (not just per artist).

---

### Key Limitations

- Artist-level genre is not returned directly. Genres must be derived by fetching individual albums.
- UPC and Record Label are only available from `/album/{id}` (individual fetch) — not from the artist albums list. For a 50-album catalog this requires 50 additional API calls.
- Artist biography, social links, and country of origin are not returned by any Deezer artist endpoint.
- `/artist/{id}/fans`, `/artist/{id}/related`, and `/artist/{id}/radio` return empty or error for small/new artists on the public API.
- Preview URLs are time-limited CDN links and should not be stored long-term.
- Track Token expires and must not be stored.
- BPM returns `0` when Deezer has not measured the track tempo.
- No equivalent to Spotify's Audio Features (danceability, energy, valence, etc.).

---

## Last.fm

What does Last.fm give Royaltē?

**Artist**
- Artist Name
- MusicBrainz Artist ID (MBID)
- Last.fm URL
- Artist Images (4 sizes)
- Streamable (boolean)
- Listeners (total unique listeners count)
- Play Count (total historical plays)
- Similar Artists (array — name, similarity score, image, URL)
- Tags (community-assigned genre and style tags with URLs)
- Biography / Wiki text (summary and full)
- Biography publication date
- Biography last updated date
- Biography source link

**Top Tracks**
- Track Name
- MusicBrainz Track ID
- Last.fm URL
- Play Count (for this artist)
- Listeners
- Rank
- Images
- Streamable (boolean)

**Top Albums**
- Album Name
- MusicBrainz Album ID
- Last.fm URL
- Play Count
- Images (4 sizes)

**Tracks (detailed)**
- Track Name
- MusicBrainz Track ID
- Last.fm URL
- Duration (seconds)
- Listeners
- Play Count
- Streamable (boolean)
- Artist
- Album
- Top Tags (community tags for this specific track)
- Wiki / Track notes (summary and full)
- Wiki publication date

**Albums (detailed)**
- Album Name
- Artist Name
- Last.fm Album ID
- MusicBrainz Album ID
- Last.fm URL
- Images (4 sizes)
- Listeners
- Play Count
- Tracks (full tracklist with play data)
- Tags (community tags for this album)
- Wiki / Album notes (summary and full)

**Tags / Genres**
- Tag Name
- Tag URL
- Reach (number of artists tagged)
- Total Taggings
- Streamable (boolean)
- Wiki / Tag description

---

## SoundCloud

What does SoundCloud give Royaltē?

**User / Artist Profile**
- SoundCloud User ID
- Permalink (username slug)
- Username / Display Name
- URI (API identifier)
- Permalink URL (profile link)
- Avatar URL
- Country
- Full Legal Name (when provided)
- Description / Bio
- City
- Discogs Name (when linked)
- MySpace Name (legacy field)
- Website URL
- Website Title
- Track Count (total uploads)
- Playlist Count
- Public Favorites Count
- Followers Count
- Followings Count
- Playlist Likes Count
- Comments Count
- Online (boolean — active now)
- Last Modified Date
- Kind identifier

**Tracks**
- SoundCloud Track ID
- Title
- Created Date
- Duration (milliseconds)
- Genre
- Tag List (array of user-assigned tags)
- Description
- ISRC (when provided)
- BPM (when provided)
- Key Signature (when provided)
- Release Year / Month / Day (when provided)
- Original Format (file type)
- License (Creative Commons or All Rights Reserved)
- State (finished, processing, etc.)
- Sharing (public, private)
- Commentable (boolean)
- Comment Count
- Streamable (boolean)
- Downloadable (boolean)
- Download Count
- Playback Count
- Likes Count
- Reposts Count
- Artwork URL
- Stream URL
- Download URL
- Waveform URL
- Purchase URL
- Purchase Title
- Label Name
- Label ID
- Video URL (when applicable)
- Permalink URL
- Track Type

---

## AudioDB

What does AudioDB give Royaltē?

**Artist**
- AudioDB Artist ID
- Artist Name
- Alternate Artist Name
- Record Label
- Label ID
- Year Formed
- Birth Year (for solo artists)
- Death / Disbandment Year
- Style
- Genre
- Mood
- Official Website
- Facebook URL
- Twitter URL
- Biography (English)
- Country Code
- Country (full name)
- Artist Thumb Image
- Artist Logo Image
- Artist Cutout Image
- Artist Clearart Image
- Artist Wide Thumb Image
- Artist Banner Image
- Artist Fanart Images (up to 4)
- Number of Members (for groups)
- ISNI
- Last.fm Chart Position
- Chart Rank Number

**Albums**
- AudioDB Album ID
- AudioDB Artist ID
- Label ID
- Album Title
- Album Title (stripped version)
- Artist Name
- Artist Name (stripped version)
- Year Released
- Style
- Genre
- Record Label
- Release Format (CD, LP, Digital, etc.)
- Sales Count
- Score (community rating)
- Score Vote Count
- Review Text (English)
- Mood
- Theme
- Speed
- Recording Location
- Album Thumb Image
- Album Thumb HQ Image
- Album Back Cover Image
- Album CD Art Image
- Album Spine Image
- Album 3D Case Image
- Album 3D Flat Image
- Album 3D Face Image
- Album 3D Thumb Image
- Description (multiple languages: EN, DE, FR, CN, IT, JP, RU, ES, PT, SE, NL, HU, NO, IL, PL)

**Tracks**
- AudioDB Track ID
- AudioDB Album ID
- AudioDB Artist ID
- Lyric ID
- IMVDB Music Video ID
- Track Title
- Album Name
- Artist Name
- Alternate Artist Name
- CD Number
- Duration (milliseconds)
- Genre
- Mood
- Style
- Theme
- Description (English)
- Track Thumbnail Image
- Music Video Thumbnail
- Music Video IMDB ID
- Music Video View Count
- Loved Count
- Score
- Score Vote Count
- MusicBrainz Track ID
- MusicBrainz Album ID
- Locked (boolean)

---

## YouTube

What does YouTube give Royaltē?

**Channel**
- YouTube Channel ID
- Channel Title / Name
- Description
- Published Date (channel creation date)
- Country
- Default Language
- Thumbnails (default, medium, high)
- Custom URL (e.g., @ArtistName)
- Subscriber Count
- Total View Count
- Total Video Count
- Hidden Subscriber Count (boolean — some channels hide subscriber count)
- Channel Keywords
- Channel Banner Image URL
- Related Playlists (uploads, likes, etc.)
- Topic Categories (YouTube-assigned content topics)
- Branding Settings (channel title, description, keywords, country, default tab, default language, tracking analytics account)
- Default Language
- Localized Title and Description

**Videos**
- YouTube Video ID
- Title
- Description
- Published Date
- Channel ID
- Channel Title
- Tags (array)
- Category ID
- Live Broadcast Content (none, live, upcoming)
- Default Language
- Thumbnails (5 sizes: default, medium, high, standard, maxres)
- View Count
- Like Count
- Comment Count
- Duration (ISO 8601 format)
- Dimension (2d or 3d)
- Definition (hd or sd)
- Caption availability (boolean)
- Licensed Content (boolean)
- Content Rating (age restriction etc.)
- Upload Status (processed, failed, rejected, deleted)
- Privacy Status (public, unlisted, private)
- License (youtube or creativeCommon)
- Embeddable (boolean)
- Topic Categories (YouTube-assigned)
- Localized Title and Description

**Search Results**
- Video, Channel, or Playlist matches
- Relevance ranking
- All core fields as above per result type

---

## Listen Notes

What does Listen Notes give Royaltē?

**Podcast Episodes (mentions of artist)**
- Episode ID
- Episode Title
- Episode Description
- Publish Date (Unix timestamp)
- Audio File URL
- Audio Duration (seconds)
- Episode Thumbnail URL
- Episode Image URL
- Maybe Audio Invalid (boolean)
- Explicit Content (boolean)
- Listen Notes Episode URL

**Podcast (parent show)**
- Podcast ID
- Podcast Title
- Publisher / Creator Name
- Total Episode Count
- Listen Score (0–100, Listen Notes popularity metric)
- Listen Score Global Rank (percentile ranking among all podcasts)
- Podcast Thumbnail
- Podcast Website
- Language
- Country
- Categories / Genres

---

## Wikidata / Wikipedia

What does Wikidata / Wikipedia give Royaltē?

**Wikidata Entity**
- Wikidata Entity ID (Q-number — permanent, globally unique)
- Labels (name in every available language)
- Descriptions (short description in every available language)
- Aliases (all alternate names in every available language)
- Statements / Claims:
  - P21 — Gender
  - P27 — Country of Citizenship
  - P31 — Instance Of (human, band, organization, etc.)
  - P106 — Occupation
  - P136 — Genre
  - P264 — Record Label
  - P434 — MusicBrainz Artist ID
  - P435 — MusicBrainz Release Group ID
  - P569 — Date of Birth
  - P570 — Date of Death
  - P19 — Place of Birth
  - P20 — Place of Death
  - P1902 — Spotify Artist ID
  - P2722 — Deezer Artist ID
  - P3040 — SoundCloud Username
  - P4821 — Last.fm Username
  - P4952 — iTunes / Apple Music Artist ID
  - P6398 — Apple Music Artist ID (alternate property)
  - P1827 — ISNI
  - P1053 — ResearchGate ID
  - P535 — Find A Grave ID
  - P856 — Official Website
  - P2037 — GitHub Username
  - P2002 — Twitter Username
  - P2003 — Instagram Username
  - P2013 — Facebook Username
  - P2397 — YouTube Channel ID
  - P18 — Image (Wikimedia Commons file)
  - P154 — Logo Image
  - P345 — IMDb ID
  - Hundreds of additional structured properties

**Wikipedia Article Summary**
- Article Title
- Article Extract (first paragraph summary — plain text)
- Short Description
- Thumbnail Image URL
- Thumbnail Source URL
- Thumbnail Dimensions
- Content URLs (Wikipedia page, mobile page, API link)
- Original Image URL and Dimensions
- Language
- Text Direction
- Article Revision ID
- Article Timestamp
- Coordinates (latitude / longitude — for places)

---

## TIDAL

What does TIDAL give Royaltē?

**Artist**
- TIDAL Artist ID
- Artist Name
- Popularity Score (0–100, TIDAL-calculated)
- Artist Image Links (multiple sizes / ratios)
- External Links (official website, social media)
- Roles (MainArtist, Featured, Composer, Lyricist, etc.)

**Albums**
- TIDAL Album ID
- Title
- UPC / Barcode
- Release Date
- Cover Images (multiple sizes)
- Video Cover (when available)
- Number of Volumes (disc count)
- Number of Items (track count)
- Total Duration (seconds)
- Explicit (boolean)
- Copyright Notice
- Popularity Score
- Audio Modes (DOLBY\_ATMOS, SONY\_360RA, STEREO)
- Media Metadata Tags (HIRES\_LOSSLESS, LOSSLESS, MQA)

**Tracks**
- TIDAL Track ID
- Title
- ISRC
- Duration (seconds)
- Copyright Notice
- Explicit (boolean)
- Popularity Score (0–100)
- Track Number
- Volume Number
- Artifact Type (track, video)
- Audio Modes available (DOLBY\_ATMOS, SONY\_360RA, STEREO)
- Media Metadata Tags (HIRES\_LOSSLESS, LOSSLESS, MQA)
- Content Properties

**Search**
- Artists, Albums, Tracks, Videos, and Playlists matching a query
- Relevance ranking
- All fields as listed above per result type

---

*This document lists the data available from each API. It does not reflect what Royaltē currently collects or uses — only what each integration is capable of providing.*
