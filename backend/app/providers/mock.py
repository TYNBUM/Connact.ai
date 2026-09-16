from copy import deepcopy

# Entirely fictional fixtures. Reserved .example domains; no real people or email addresses.
PEOPLE = [
    (
        "Olivia Chen",
        "Vice President, Investment Banking",
        "Aster Capital",
        "New York, US",
        "Investment Banking",
        "Columbia University",
    ),
    (
        "James Park",
        "Investment Banking Associate",
        "Northstar Partners",
        "New York, US",
        "Investment Banking",
        "New York University",
    ),
    (
        "Sofia Martinez",
        "Director, Private Equity",
        "Cedar Bridge Equity",
        "London, UK",
        "Private Equity",
        "",
    ),
    (
        "Ethan Brooks",
        "Portfolio Manager",
        "Harbor Asset Management",
        "Boston, US",
        "Asset Management",
        "Boston University",
    ),
    (
        "Amelia Wang",
        "Principal, Venture Capital",
        "Lumen Ventures",
        "San Francisco, US",
        "Venture Capital",
        "",
    ),
    (
        "Daniel Kim",
        "Investment Banking Analyst",
        "Aster Capital",
        "Hong Kong",
        "Investment Banking",
        "University of Hong Kong",
    ),
    (
        "Charlotte Evans",
        "Managing Director, M&A",
        "Northstar Partners",
        "London, UK",
        "Investment Banking",
        "",
    ),
    (
        "Noah Patel",
        "Investment Analyst",
        "Cedar Bridge Equity",
        "Singapore",
        "Private Equity",
        "",
    ),
    (
        "Isabella Rossi",
        "Head of Risk Management",
        "Summit Financial",
        "London, UK",
        "Risk Management",
        "",
    ),
    (
        "Lucas Zhang",
        "Equity Research Analyst",
        "Harbor Asset Management",
        "New York, US",
        "Asset Management",
        "",
    ),
    (
        "Mia Thompson",
        "Vice President, Private Equity",
        "Cedar Bridge Equity",
        "New York, US",
        "Private Equity",
        "",
    ),
    (
        "Oliver Lee",
        "Venture Capital Associate",
        "Lumen Ventures",
        "Singapore",
        "Venture Capital",
        "",
    ),
    (
        "Grace Wilson",
        "Credit Risk Analyst",
        "Summit Financial",
        "Hong Kong",
        "Risk Management",
        "",
    ),
    (
        "Leo Davis",
        "Investment Banking Director",
        "Aster Capital",
        "London, UK",
        "Investment Banking",
        "",
    ),
    (
        "Chloe Liu",
        "Investment Strategist",
        "Harbor Asset Management",
        "Singapore",
        "Asset Management",
        "",
    ),
    (
        "Henry Taylor",
        "Partner, Venture Capital",
        "Lumen Ventures",
        "New York, US",
        "Venture Capital",
        "",
    ),
]


ACADEMIC_PEOPLE = [
    (
        "Avery Lin",
        "Assistant Professor of Computer Science",
        "Redwood University",
        "California, US",
        "Machine Learning and Medical Imaging",
        "Redwood University",
    ),
    (
        "Maya Okafor",
        "Associate Professor of Biomedical Engineering",
        "Lakeview Institute of Technology",
        "Massachusetts, US",
        "Biomedical AI and Computational Imaging",
        "Lakeview Institute of Technology",
    ),
    (
        "Theo Martin",
        "Professor of Economics",
        "Northbridge University",
        "London, UK",
        "Labor Economics and Public Policy",
        "Northbridge University",
    ),
    (
        "Priya Raman",
        "Assistant Professor of Electrical Engineering",
        "Harbor Technical University",
        "Singapore",
        "Robotics and Human Computer Interaction",
        "Harbor Technical University",
    ),
    (
        "Elena Petrova",
        "Professor of Computational Biology",
        "Cedar Research University",
        "Toronto, Canada",
        "Genomics and Systems Biology",
        "Cedar Research University",
    ),
    (
        "Samuel Adeyemi",
        "Associate Professor of Environmental Science",
        "Summit State University",
        "Colorado, US",
        "Climate Modeling and Remote Sensing",
        "Summit State University",
    ),
    (
        "Noor Hassan",
        "Assistant Professor of Psychology",
        "Eastport University",
        "New York, US",
        "Cognitive Neuroscience and Learning",
        "Eastport University",
    ),
    (
        "Lucas Ferreira",
        "Professor of Materials Science",
        "Aurora Polytechnic",
        "Zurich, Switzerland",
        "Energy Materials and Nanotechnology",
        "Aurora Polytechnic",
    ),
    (
        "Mei Tan",
        "Associate Professor of Public Health",
        "Meridian University",
        "Hong Kong",
        "Digital Health and Epidemiology",
        "Meridian University",
    ),
    (
        "Jonas Berg",
        "Assistant Professor of Data Science",
        "Baltic Institute of Science",
        "Stockholm, Sweden",
        "Causal Inference and Responsible AI",
        "Baltic Institute of Science",
    ),
    (
        "Sofia Alvarez",
        "Professor of Sociology",
        "Granite Coast University",
        "Madrid, Spain",
        "Migration Studies and Social Networks",
        "Granite Coast University",
    ),
    (
        "Kenji Sato",
        "Associate Professor of Computer Engineering",
        "Pacific Metropolitan University",
        "Tokyo, Japan",
        "Distributed Systems and Edge Computing",
        "Pacific Metropolitan University",
    ),
]


def fixtures():
    return [
        dict(
            provider="mock",
            provider_id=f"demo-{i+1}",
            name=p[0],
            title=p[1],
            company=p[2],
            location=p[3],
            sector=p[4],
            school=p[5],
            profile_url="",
            email="",
            email_status="available" if i % 3 else "unknown",
        )
        for i, p in enumerate(PEOPLE)
    ]


def academic_fixtures():
    return [
        dict(
            provider="mock",
            provider_id=f"academic-demo-{i+1}",
            name=p[0],
            title=p[1],
            company=p[2],
            location=p[3],
            sector=p[4],
            school=p[5],
            profile_url="",
            email="",
            email_status="available" if i % 3 == 0 else "unknown",
        )
        for i, p in enumerate(ACADEMIC_PEOPLE)
    ]


def filtered(rows, filters):
    for field in ("title", "company", "location", "sector"):
        if filters.get(field):
            rows = [r for r in rows if filters[field].lower() in r[field].lower()]
    if filters.get("keywords"):
        words = filters["keywords"].lower().split()
        rows = [
            r for r in rows if all(w in " ".join(r.values()).lower() for w in words)
        ]
    start = (filters["page"] - 1) * filters["per_page"]
    return {
        "people": deepcopy(rows[start : start + filters["per_page"]]),
        "total": len(rows),
    }


class MockPeople:
    def search(self, filters):
        return filtered(fixtures(), filters)

    def enrich(self, contact):
        n = int(contact["provider_id"].split("-")[-1])
        email = (
            contact["name"].lower().replace(" ", ".") + "@demo.example" if n % 3 else ""
        )
        return {
            "email": email,
            "email_status": "mock_available" if email else "unavailable",
        }


class MockAcademicPeople(MockPeople):
    def search(self, filters):
        return filtered(academic_fixtures(), filters)


class MockPublic:
    def search(self, contact):
        return [
            {
                "provider": "mock",
                "url": "",
                "title": "Fictional public-profile example",
                "snippet": f"{contact['name']} — {contact['title']} at {contact['company']}. Demo fixture, not a verified public source.",
                "kind": "unverified_lead",
            }
        ]
