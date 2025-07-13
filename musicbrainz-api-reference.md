# MusicBrainz API Reference

## Overview

MusicBrainz is a comprehensive music metadata database that provides structured information about musical entities and their relationships. The API offers access to 13 different entity types organized into normal (publicly accessible) and restricted (privileged user) categories.

## Entity Categories

### Normal Entities (Public Access)

#### Artist
**Definition**: Musicians, groups, collaborations, or music professionals

**Types**:
- Person
- Group
- Orchestra
- Choir
- Character
- Other

**Key Attributes**:
- `name`: Official artist name
- `sort_name`: Name for alphabetical sorting
- `type`: Artist classification
- `gender`: For persons/characters (male, female, neither)
- `area`: Primary geographic association
- `begin_date`/`end_date`: Creation/dissolution timeline
- `mbid`: MusicBrainz Identifier
- `ipi_code`: Industry identifier
- `isni_code`: International Standard Name Identifier
- `aliases`: Alternative names or misspellings
- `disambiguation`: Clarifying details
- `annotation`: Additional contextual information

**Examples**: Coldplay (group), Snoop Dogg (person), Seattle Symphony (orchestra)

#### Recording
**Definition**: Distinct audio that has been used to produce at least one released track

**Key Attributes**:
- `title`: Name of the recording
- `artist`: Primary credited artist(s)
- `length`: Calculated as median length of associated tracks
- `isrc`: International Standard Recording Code
- `mbid`: MusicBrainz Identifier
- `disambiguation`: Clarifying comment
- `annotation`: Additional details

**Relationships**:
- Each track must be associated with a single recording
- A recording can be linked to multiple tracks
- Supports different versions (studio, live, remixed)

**Examples**: "Into the Blue" by Moby (studio), "Into the Blue (Beatmasters mix)" by Moby (remix)

#### Release
**Definition**: Unique issuing of a musical product containing one or more audio mediums

**Key Attributes**:
- `title`: Release title
- `artist_credit`: Artist attribution
- `date`: Release date
- `country`: Country of release
- `label`: Record label(s)
- `catalog_number`: Label's catalog identifier
- `barcode`: Product barcode
- `status`: Official, promotion, bootleg, etc.
- `packaging`: Physical packaging type
- `language`: Text language
- `script`: Writing system
- `mbid`: MusicBrainz Identifier

**Structure**:
- Contains multiple mediums (e.g., multi-CD sets)
- Each medium has format (CD, vinyl, digital) and tracklist
- Quality levels: High, Default, Low

#### Release Group
**Definition**: Logical grouping representing the conceptual "album"

**Key Attributes**:
- `title`: Usually matches contained releases
- `artist`: Typically matches release artists
- `type`: Album, single, soundtrack, etc.
- `mbid`: MusicBrainz Identifier
- `disambiguation`: Additional clarifying information
- `annotation`: Extended descriptive notes

**Characteristics**:
- Every release belongs to exactly one release group
- Can contain multiple releases (different editions, countries, formats)
- Automatically created when new release is added

#### Work
**Definition**: Distinct intellectual or artistic creation

**Types**:
- Discrete Works: Individual songs, movements
- Aggregate Works: Ordered sequences (symphonies, operas, concept albums)

**Key Attributes**:
- `name`: Canonical title in original language
- `type`: Classification of the work
- `aliases`: Alternative names or languages
- `lyrics_languages`: Languages used in the work
- `iswc`: International Standard Musical Work Code
- `mbid`: MusicBrainz Identifier
- `disambiguation`: Clarifying details
- `annotation`: Additional contextual information

**Relationships**:
- Work-to-Artist: Composers, arrangers, lyricists
- Work-to-Recording: Associates works with recordings
- Work-to-Work: Part-of relationships, derivatives

#### Label
**Definition**: Imprints and record companies for marketing sound recordings

**Key Attributes**:
- `name`: Official name as found on media
- `type`: Describes main activity
- `area`: Geographic origin
- `begin_date`/`end_date`: Registration/dissolution dates
- `label_code`: LC identifier
- `ipi_code`: Industry identifier
- `isni_code`: International Standard Name Identifier
- `mbid`: MusicBrainz Identifier

**Guidelines**:
- Names should reflect trademark representation
- Renamed labels create new entries with rename relationships
- Focus on music-related information

#### Event
**Definition**: Organized activity relevant to music performance, production, or celebration

**Types**:
- Concert
- Festival
- Stage performance
- Award ceremony
- Launch event
- Convention/Expo
- Masterclass/Clinic

**Key Attributes**:
- `name`: Official or descriptive event name
- `type`: Event categorization
- `cancelled`: Whether event occurred
- `setlist`: List of performed songs
- `begin_date`/`end_date`: Event timeframe
- `time`: Start time
- `aliases`: Alternative names
- `mbid`: MusicBrainz Identifier
- `disambiguation`: Event details clarification
- `annotation`: Additional context

#### Place
**Definition**: Building or outdoor area used for performing or producing music

**Types**:
- Studio
- Venue
- Amphitheatre
- Club
- Concert hall/Theatre
- Festival stage
- Stadium
- Indoor arena
- Educational institution
- Park
- Religious building
- Pressing plant
- Other

**Key Attributes**:
- `name`: Official place name
- `type`: Primary function category
- `address`: Location details
- `coordinates`: Latitude and longitude
- `area`: Linked city/region
- `begin_date`/`end_date`: Operational dates
- `aliases`: Alternative names
- `mbid`: MusicBrainz Identifier
- `disambiguation`: Clarifying comment
- `annotation`: Additional information

#### Series
**Definition**: Sequence of entities with a common theme

**Key Attributes**:
- `name`: Series title
- `type`: Series classification
- `mbid`: MusicBrainz Identifier
- `disambiguation`: Clarifying details
- `annotation`: Additional context

#### URL
**Definition**: Internet links with descriptions

**Key Attributes**:
- `url`: Web address
- `description`: Link description
- `mbid`: MusicBrainz Identifier

### Restricted Entities (Privileged Access Only)

#### Area
**Definition**: Geographic regions or settlements synchronized with Wikidata

**Types**:
- Country
- Subdivision
- County
- Municipality
- City
- District
- Island

**Key Attributes**:
- `name`: Primary geographic name
- `type`: Geographic classification
- `begin_date`/`end_date`: Foundation/cessation dates
- `iso_3166_codes`: Official geographic identification
- `aliases`: Alternate names
- `mbid`: MusicBrainz Identifier
- `annotation`: Descriptive information

**Submission**: New areas require bug request under AREQ category

#### Genre
**Definition**: Music categorization through folksonomy tagging system

**Characteristics**:
- Community-driven classification
- Subjective and user-voted
- Expandable through style tickets
- Integrated with tagging system
- No formal structured metadata

**User Actions**:
- Upvote/downvote existing genres
- Submit new genres
- Request additions via style tickets

#### Instrument
**Definition**: Devices created or adapted to make musical sounds

**Types**:
- Wind instrument
- String instrument
- Percussion instrument
- Electronic instrument
- Family
- Ensemble
- Other instrument

**Key Attributes**:
- `name`: Primary instrument name (typically English)
- `type`: Sound creation method category
- `description`: Brief characteristic overview
- `aliases`: Alternative names with localization
- `mbid`: MusicBrainz Identifier
- `disambiguation`: Distinction between similar instruments
- `annotation`: Additional context

**Usage**: Primarily for entity relationships, editable by relationship editors only

## API Usage Patterns

### 1. Unique Identification
- All entities use MusicBrainz Identifiers (MBID) for precise referencing
- UUIDs provide stable, permanent references

### 2. Relationship System
- Complex interconnections between all entity types
- Artist-to-Work relationships (composer, lyricist, arranger)
- Recording-to-Release associations
- Work-to-Work hierarchies (parts, derivatives)

### 3. Hierarchical Structure
```
Release Groups
└── Releases
    └── Mediums
        └── Tracks
            └── Recordings
                └── Works
```

### 4. Geographic Context
- Area entities provide location-based organization
- Artists, Labels, Places, Events linked to geographic regions
- ISO codes for standardized geographic references

### 5. Temporal Data
- Begin/end dates track entity lifecycles
- Event scheduling and duration tracking
- Historical context for musical entities

### 6. Multilingual Support
- Aliases support multiple languages and localizations
- Search hints for improved discoverability
- Original language preservation with translations

### 7. Data Quality Indicators
- Quality levels (High, Default, Low) for reliability assessment
- Community-driven data validation
- Disambiguation comments for clarity

### 8. Metadata Standards
- Industry standard codes (ISRC, ISWC, IPI, ISNI, LC)
- ISO standards for geographic and temporal data
- Consistent naming and identification schemes

## Best Practices

1. **Entity Relationships**: Utilize the relationship system to connect related entities meaningfully
2. **Disambiguation**: Use disambiguation comments to distinguish between similar entities
3. **Geographic Accuracy**: Link entities to appropriate Area entities for geographic context
4. **Temporal Precision**: Provide accurate begin/end dates where known
5. **Alias Management**: Use aliases for alternative names, misspellings, and localizations
6. **Quality Maintenance**: Strive for high-quality, complete metadata entries
7. **Standard Compliance**: Follow industry standards for codes and identifiers
8. **Community Guidelines**: Adhere to MusicBrainz style guidelines for consistent data entry

This comprehensive entity system enables detailed music catalog management from individual recordings to complete artist discographies, supporting complex queries and relationship exploration across the entire music ecosystem.