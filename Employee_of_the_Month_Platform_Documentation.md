# Employee of the Month Platform

## Product Requirements & System Documentation

**Document Version:** 1.0  
**Date:** September 2026  
**Platform Type:** Web-Based Employee Recognition & Voting Platform

---

# 1. Executive Summary

The **Employee of the Month Platform** is a simple, user-friendly internal web portal designed to allow employees to recognize and vote for colleagues who have demonstrated outstanding performance during a particular month.

The platform will evaluate employees against four predefined performance parameters:

| Parameter | Weight |
|---|---:|
| Timeliness | 30% |
| Supporting Others | 40% |
| Interpersonal Skills | 15% |
| Innovation | 15% |
| **Total** | **100%** |

The system will calculate monthly performance scores, determine the **Employee of the Month**, and maintain historical performance data to identify the **Overall Employee of the Year**.

The platform should emphasize:

- Simplicity
- Fairness
- Transparency
- Employee engagement
- Easy voting
- Automated scoring
- Monthly recognition
- Annual performance tracking
- Microsoft Active Directory / Microsoft Entra ID authentication

---

# 2. Objectives

The primary objectives are to:

1. Create a structured employee recognition system.
2. Allow employees to vote for colleagues based on defined performance criteria.
3. Reduce subjective or informal employee recognition.
4. Encourage teamwork and positive workplace behavior.
5. Automatically calculate monthly employee scores.
6. Identify the Employee of the Month.
7. Track performance throughout the year.
8. Identify the Overall Employee of the Year.
9. Provide management with useful performance insights.
10. Create a culture where employees recognize and appreciate each other's contributions.
11. Allow employees to authenticate using their existing organizational Microsoft accounts.

---

# 3. Core Concept

At the beginning or during each month, employees will access the portal and nominate/vote for colleagues they believe have performed exceptionally well.

Instead of simply asking:

> "Who should be Employee of the Month?"

the platform will require employees to evaluate candidates against the four defined performance parameters.

Each criterion contributes a specific percentage to the final score.

### Scoring Model

**Final Score =**

`Timeliness Score × 30%`

`+ Supporting Others Score × 40%`

`+ Interpersonal Skills Score × 15%`

`+ Innovation Score × 15%`

For example:

| Criterion | Employee Score | Weight | Weighted Score |
|---|---:|---:|---:|
| Timeliness | 85 | 30% | 25.5 |
| Supporting Others | 90 | 40% | 36 |
| Interpersonal Skills | 80 | 15% | 12 |
| Innovation | 75 | 15% | 11.25 |
| **Final Score** | | **100%** | **84.75** |

---

# 4. Performance Parameters

## 4.1 Timeliness — 30%

This measures how effectively an employee completes responsibilities within the expected timeframe.

Examples include:

- Reporting on time
- Completing assigned tasks on time
- Responding to requests promptly
- Resolving problems within reasonable time
- Meeting deadlines
- Responding to urgent situations
- Following through on commitments

### Suggested Rating

Employees can rate the candidate from **1–5**:

| Rating | Description |
|---:|---|
| 1 | Needs significant improvement |
| 2 | Below expectations |
| 3 | Meets expectations |
| 4 | Very good |
| 5 | Exceptional |

---

# 5. Supporting Others — 40%

This is the most heavily weighted category.

It measures how effectively an employee supports colleagues and contributes to teamwork.

Examples include:

- Helping colleagues solve problems
- Sharing knowledge
- Supporting colleagues during busy periods
- Helping new employees
- Collaborating across departments
- Volunteering to assist others
- Being available when colleagues need assistance

The platform should emphasize that this criterion evaluates **meaningful workplace support**, rather than simply being popular.

---

# 6. Interpersonal Skills — 15%

This measures how effectively the employee interacts and communicates with colleagues.

Examples include:

- Respectful communication
- Team communication
- Listening
- Professional behavior
- Conflict management
- Cooperation
- Positive workplace relationships

---

# 7. Innovation — 15%

This measures an employee's contribution of new ideas and improvements.

Examples include:

- Introducing new ideas
- Improving existing processes
- Finding better ways of solving problems
- Automating repetitive tasks
- Reducing unnecessary costs
- Improving customer service
- Introducing technology
- Suggesting practical solutions

Innovation does not necessarily mean creating something completely new. Improving an existing process should also qualify.

---

# 8. User Roles

The system should have different levels of access.

## 8.1 Employee

Employees should be able to:

- Log in using their organizational Microsoft account
- View current Employee of the Month campaign
- View eligible employees
- Vote
- Rate candidates
- Provide optional comments/reasons
- View previous winners
- View their own recognition history
- View rankings where permitted

Employees should not be able to:

- Modify votes
- Vote multiple times
- Vote for themselves
- View confidential administrative information
- Modify employee records

---

## 8.2 Administrator

Administrators should be able to:

- Create and manage employee records
- Edit employee information
- Disable employees
- Create monthly voting campaigns
- Configure voting dates
- Configure scoring parameters
- View voting results
- View analytics
- Export reports
- Manage winners
- Manage departments
- Manage system settings

---

## 8.3 Management / HR

Management users should have access to:

- Monthly results
- Employee performance history
- Department statistics
- Annual performance
- Recognition trends
- Voting participation
- Reports

Management should not necessarily be able to modify employee votes.

---

# 9. Authentication and Active Directory Integration

## 9.1 Authentication Requirement

The Employee of the Month platform shall use the organization's existing employee accounts for authentication.

Employees should **not** be required to create separate usernames and passwords for the platform.

The platform shall support authentication through:

**Microsoft Active Directory / Microsoft Entra ID**

This allows employees to access the platform using the same organizational account they already use for services such as:

- Microsoft 365
- Outlook
- Microsoft Teams
- SharePoint
- OneDrive
- Other organization systems

---

## 9.2 Single Sign-On (SSO)

The preferred authentication method is **Single Sign-On (SSO)** using Microsoft Entra ID.

The employee experience should be:

```text
Employee opens Employee of the Month Portal
              ↓
       Click "Sign In"
              ↓
       Microsoft Sign-In
              ↓
   Employee authenticates
              ↓
    Microsoft verifies account
              ↓
       Portal grants access
              ↓
       Employee Dashboard
```

If the employee is already logged into their organization's Microsoft account, authentication should require minimal additional interaction.

---

## 9.3 Authentication Technology

The recommended authentication protocols are:

- **OpenID Connect (OIDC)**
- **OAuth 2.0**

Microsoft Entra ID will act as the **Identity Provider (IdP)**.

The Employee of the Month application will act as the client/application.

### Authentication Flow

```text
                 Microsoft Entra ID
                       │
                       │ Authentication
                       ▼
Employee ───────► Employee Portal
                       │
                       │ Access Token / ID Token
                       ▼
                 Application Backend
```

The application must validate the identity token before creating an authenticated application session.

---

# 10. Existing Active Directory Environment

Where the organization has an on-premises Microsoft Active Directory environment, the recommended architecture is:

```text
                 On-Premises
               Active Directory
                      │
                      │
              Entra Connect /
                Cloud Sync
                      │
                      ▼
              Microsoft Entra ID
                      │
                      │ SSO
                      ▼
          Employee of the Month
                  Platform
```

This allows the organization to continue managing employees through its existing Active Directory environment while allowing the web application to use Microsoft Entra ID for authentication.

---

# 11. Employee Identity

The application should not require employees to manually create accounts.

Instead, when an employee signs in for the first time, the application should obtain their identity information from Microsoft Entra ID.

Possible information includes:

| Information | Example |
|---|---|
| Name | John Doe |
| Email | john.doe@company.com |
| Employee ID | EMP00125 |
| Department | Information Technology |
| Job Title | Network Administrator |
| Account Status | Active |

Only information required by the application should be stored.

---

# 12. Automatic Employee Provisioning

A new employee should be able to access the system without an administrator manually creating a separate username and password.

Example:

```text
New employee created in AD
          ↓
Account synchronized with Entra ID
          ↓
Employee logs into the platform
          ↓
Platform recognizes employee
          ↓
Employee profile created/updated
          ↓
Employee accesses dashboard
```

The application can create the local employee record on first successful login.

This approach is commonly referred to as **Just-In-Time (JIT) provisioning**.

---

# 13. Employee ID

Where possible, the application should use the organization's existing **Employee ID** as the employee's unique business identifier.

The platform should not use the employee's name as the unique identifier because names can change or be duplicated.

Recommended identity structure:

```text
Microsoft Account
        ↓
Microsoft User ID
        ↓
Employee ID
        ↓
Employee Portal Profile
```

The database should retain a stable identifier associated with the Microsoft account.

---

# 14. Role Management

The application should support role-based access.

Recommended roles:

### Employee

Can:

- Sign in using organizational account
- Vote
- View current campaign
- View previous winners
- View permitted recognition information

### HR / Management

Can:

- View results
- View reports
- View employee performance history
- Manage recognition campaigns

### Administrator

Can:

- Configure campaigns
- Manage system settings
- Manage eligibility
- Manage application users
- View audit logs
- Configure integrations

---

# 15. Recommended Role Assignment Using Microsoft Groups

Rather than manually assigning roles to every employee, Microsoft Entra groups can be used.

For example:

```text
Microsoft Entra ID
│
├── EOM-Employees
│
├── EOM-HR
│
└── EOM-Administrators
```

The application can map these groups to application roles.

Example:

```text
EOM-Employees
      ↓
Employee Role

EOM-HR
      ↓
HR Role

EOM-Administrators
      ↓
Administrator Role
```

This means that when an employee's organizational role changes, access to the platform can be managed through the organization's existing identity-management process.

---

# 16. Department Information

If department information is available in the organization's directory, the application should use it rather than requiring employees to manually enter their department.

For example:

```text
Microsoft Entra ID

John Doe
Email: john.doe@company.com
Department: ICT
Job Title: Network Engineer
Employee ID: EMP00125
```

The platform can use this information for:

- Department reports
- Department participation
- Employee profiles
- Analytics
- Eligibility rules

---

# 17. Account Deactivation

Employee access should automatically follow the organization's account status.

If an employee leaves the organization and their Microsoft account is disabled:

```text
AD / Entra account disabled
          ↓
Employee cannot authenticate
          ↓
Portal access denied
```

The employee's historical voting and recognition information should **not** be deleted.

Their historical records should remain available for reporting.

---

# 18. Security Requirements

The platform should not store Microsoft employee passwords.

The application should never ask employees for their Microsoft password.

Instead, authentication should occur through Microsoft.

Security requirements should include:

- HTTPS/TLS
- OAuth 2.0
- OpenID Connect
- Secure token validation
- Role-based authorization
- Secure session management
- Token expiration handling
- Audit logging
- Protection against CSRF
- Protection against XSS
- Protection against SQL injection
- Secure secrets management

---

# 19. Multi-Factor Authentication

The platform should support the organization's existing Microsoft authentication policies.

If the organization requires MFA through Microsoft Entra ID, the Employee of the Month platform should inherit that requirement.

For example:

```text
Employee
   ↓
Microsoft Login
   ↓
Password
   ↓
MFA
   ↓
Authentication Successful
   ↓
Employee of the Month Portal
```

The Employee of the Month application should not create a second independent MFA system unless there is a specific business requirement.

---

# 20. Sign-In Experience

The login page should be extremely simple.

```text
┌─────────────────────────────────────┐
│                                     │
│      EMPLOYEE OF THE MONTH          │
│                                     │
│   Recognizing Excellence Together   │
│                                     │
│   [ Sign in with Microsoft 365 ]    │
│                                     │
└─────────────────────────────────────┘
```

The employee clicks:

**Sign in with Microsoft 365**

and is redirected to Microsoft's authentication service.

---

# 21. Authentication Error Handling

The application should provide clear messages.

### Unauthorized Account

> Your organizational account is not authorized to access this platform. Please contact HR or the system administrator.

### Disabled Account

> Your organizational account is currently inactive. Please contact your organization's IT department.

### Authentication Failure

> We could not authenticate your organizational account. Please try again.

The application should not expose technical authentication details to the employee.

---

# 22. Employee Dashboard

After logging in, an employee should see a simple dashboard.

### Dashboard Components

**Welcome**

> Welcome, [Employee Name]

### Current Campaign

**September 2026 Employee of the Month**

Status:

> Voting Open

Deadline:

> 30 September 2026

Button:

> **Vote Now**

### Previous Winners

Display cards such as:

**August 2026**

Employee Name  
Department  
Score: 91.5

### Recognition

The employee could also see:

- Number of times they have been nominated
- Number of months they have won
- Annual score
- Recognition badges

---

# 23. Voting Process

The voting process should be extremely simple.

## Step 1 — Login

Employee signs in using their organizational Microsoft account.

## Step 2 — Open Current Campaign

The employee clicks:

**Vote for Employee of the Month**

## Step 3 — Select Employee

The system displays eligible employees.

Example:

- John Doe
- Mary Smith
- Peter Okello
- Sarah Namukasa
- David Kato

The employee selects one candidate.

---

# 24. Candidate Evaluation

After selecting a candidate, the employee completes the evaluation.

### Example

**You are voting for:**

> John Doe

### Timeliness

How would you rate John's timeliness?

- 1
- 2
- 3
- 4
- 5

### Supporting Others

How would you rate John's support for colleagues?

- 1
- 2
- 3
- 4
- 5

### Interpersonal Skills

- 1
- 2
- 3
- 4
- 5

### Innovation

- 1
- 2
- 3
- 4
- 5

### Optional Comment

> What makes this employee deserving of recognition?

Then:

**SUBMIT VOTE**

---

# 25. Voting Rules

The system should enforce strict voting rules.

1. One employee can submit **one vote per month**.
2. Employees cannot vote for themselves.
3. Employees cannot change their vote after submission unless an administrator explicitly reopens it.
4. Votes should be timestamped.
5. The system should record the voter securely.
6. Voting should automatically close at the configured deadline.
7. Employees who join after voting opens should follow the organization's configured eligibility rules.
8. Employees who leave the organization should become inactive.
9. Administrators should not be able to casually modify votes.
10. Any administrative override should be recorded in an audit log.

---

# 26. Anonymous vs Transparent Voting

The system should support configurable voting visibility.

### Option A — Anonymous Voting

Employees can see:

> Your vote has been successfully submitted.

But they cannot see who voted for whom.

### Option B — Identified Voting

Management can see voter identities.

### Recommended System Design

Store the voter identity securely for auditing purposes, but **do not expose individual voting information to ordinary employees**.

Administrators can access it only where organizational policy requires it.

---

# 27. Scoring Engine

The system should automatically calculate scores.

Assume an employee receives:

- Timeliness = 4.5/5
- Supporting Others = 4.8/5
- Interpersonal Skills = 4.2/5
- Innovation = 4.0/5

Convert the ratings into percentages.

### Formula

```text
Timeliness Contribution
= (4.5 / 5) × 30
= 27

Supporting Contribution
= (4.8 / 5) × 40
= 38.4

Interpersonal Contribution
= (4.2 / 5) × 15
= 12.6

Innovation Contribution
= (4.0 / 5) × 15
= 12
```

### Final Score

```text
27 + 38.4 + 12.6 + 12
= 90/100
```

The candidate receives:

**90%**

---

# 28. Multiple Votes and Aggregation

The system should not determine the winner from a single employee's rating.

Instead, it should aggregate all valid votes.

For example:

| Employee | Evaluations | Average Score |
|---|---:|---:|
| John | 25 | 89.6 |
| Mary | 22 | 87.3 |
| Sarah | 30 | 85.7 |
| Peter | 18 | 84.9 |

The monthly winner should be determined using the configured scoring methodology.

The system should display the **number of valid evaluations** alongside scores.

Example:

> John Doe  
> Score: 91.4  
> Evaluations: 37

---

# 29. Eligibility Rules

The organization should be able to configure eligibility.

Possible rules:

- Employee must have worked for at least 30 days.
- Employee must be active.
- Employees cannot vote for themselves.
- Employees on probation may or may not be eligible.
- Managers may or may not participate.
- Employees on extended leave may be excluded.

These should be configurable rather than hard-coded.

---

# 30. Monthly Winner

When voting closes, the system automatically calculates the results.

### September 2026 Results

| Rank | Employee | Department | Score | Evaluations |
|---:|---|---|---:|---:|
| 1 | John Doe | IT | 91.4 | 37 |
| 2 | Mary Smith | Finance | 89.7 | 41 |
| 3 | Peter Okello | Operations | 87.9 | 35 |

The system identifies:

# Employee of the Month

**John Doe**

**Score: 91.4/100**

---

# 31. Winner Announcement

The system should have an engaging winner page.

# Employee of the Month

## September 2026

**John Doe**

**IT Department**

**91.4 / 100**

### Performance Breakdown

| Category | Score |
|---|---:|
| Timeliness | 93% |
| Supporting Others | 95% |
| Interpersonal Skills | 87% |
| Innovation | 86% |

### Recognition

> Recognized by colleagues for exceptional teamwork, responsiveness and contribution to solving workplace challenges.

---

# 32. Employee of the Year

The system should maintain monthly results throughout the year.

At the end of the year, it calculates annual performance.

### Example

| Month | Employee | Score |
|---|---|---:|
| January | John | 88 |
| February | Mary | 91 |
| March | John | 94 |
| April | Sarah | 89 |
| May | John | 92 |
| June | Peter | 90 |
| July | John | 95 |
| August | Mary | 93 |
| September | John | 91 |
| October | Sarah | 94 |
| November | John | 96 |
| December | Mary | 95 |

### Recommended Annual Score

Calculate the employee's **average monthly performance score** across eligible months.

```text
Annual Score =
Sum of Monthly Scores
÷
Number of Eligible Months
```

The system can additionally show:

- Number of monthly wins
- Number of nominations
- Average score
- Highest monthly score
- Number of months recognized

---

# 33. Annual Leaderboard

The management dashboard can display:

| Rank | Employee | Annual Score | Monthly Wins |
|---:|---|---:|---:|
| 1 | Employee A | 94.2 | 4 |
| 2 | Employee B | 92.8 | 3 |
| 3 | Employee C | 91.5 | 2 |

The annual score should be the primary annual performance measure rather than simply ranking employees by number of monthly awards.

---

# 34. Tie-Breaking Mechanism

A tie-breaking mechanism is required.

Recommended order:

1. Highest **Supporting Others** score.
2. Highest **Timeliness** score.
3. Highest **Interpersonal Skills** score.
4. Highest **Innovation** score.
5. If still tied, HR/management performs a documented review according to organizational policy.

The tie-breaking rules should be visible in the system documentation.

---

# 35. Administrator Dashboard

The administrator dashboard should provide an overview.

### Dashboard

**Current Month**

September 2026

**Voting Status**

OPEN

### Statistics

- Total Employees: 250
- Eligible Employees: 237
- Votes Submitted: 189
- Participation: 79.7%
- Days Remaining: 6

### Current Leader

Employee Name

Score: 92.4

---

# 36. Analytics

The platform should provide analytics such as:

### Employee Analytics

- Monthly score
- Annual score
- Number of nominations
- Number of wins
- Average criterion score
- Recognition history

### Department Analytics

- Department participation
- Average department score
- Number of winners
- Number of nominations

### Voting Analytics

- Total votes
- Participation rate
- Votes per department
- Voting trends
- Monthly participation

---

# 37. Recognition History

Each employee should have a recognition profile.

Example:

## John Doe

**Department:** Information Technology

### Recognition History

| Month | Result | Score |
|---|---|---:|
| March 2026 | Employee of the Month | 94 |
| July 2026 | Employee of the Month | 95 |
| November 2026 | Employee of the Month | 96 |

### Statistics

**Monthly Wins:** 3

**Average Score:** 93.8

**Best Score:** 96

---

# 38. Notifications

The system should send notifications for important events.

### Voting Opens

> Employee of the Month voting for September is now open.

### Voting Reminder

> Employee of the Month voting closes tomorrow. Make sure your vote is submitted.

### Voting Closed

> Voting for September Employee of the Month has closed.

### Winner Announcement

> Congratulations to John Doe, our September Employee of the Month.

Possible channels:

- Email
- In-platform notifications
- SMS — optional
- Microsoft Teams/Slack — optional

---

# 39. Engagement Features

To make the platform more engaging without turning it into a social-media platform, the system could include:

### Recognition Badges

Examples:

- Team Player
- Innovation Champion
- Problem Solver
- Most Supportive
- Timeliness Champion

### Winner Wall

A page displaying previous winners.

### Monthly Spotlight

Show:

- Winner photo
- Department
- Score
- Key recognition comments
- Performance breakdown

### Recognition Streak

For example:

> 3 Months Recognized

---

# 40. Comments and Recognition Messages

Employees should have an optional field:

> Why are you recognizing this employee?

Example:

> "John consistently supports the team whenever there is a technical issue and responds quickly when colleagues need assistance."

These comments can be reviewed by HR before appearing publicly.

---

# 41. Security Requirements

The platform should include:

- Secure Microsoft SSO
- Role-based access control
- Passwords never stored by the application
- Secure token validation
- HTTPS/TLS
- Input validation
- Protection against duplicate voting
- Protection against SQL injection
- Protection against XSS
- CSRF protection
- Audit logs
- Secure database access
- Backup and recovery
- Secure secrets management

---

# 42. Audit Trail

Important actions should be logged.

Examples:

```text
Employee Login
Vote Submitted
Vote Updated
Campaign Created
Campaign Closed
Employee Created
Employee Disabled
Result Published
Administrator Override
Role Changed
```

Each audit entry should contain:

- User
- Action
- Date/time
- IP address where appropriate
- Relevant record
- Previous value
- New value

---

# 43. Suggested Database Structure

A relational database such as PostgreSQL or MySQL would be suitable.

### Users

```text
users
------
id
entra_object_id
employee_id
first_name
last_name
email
phone
department_id
job_title
role
status
created_at
updated_at
```

### Departments

```text
departments
-----------
id
name
description
status
```

### Campaigns

```text
campaigns
---------
id
name
month
year
start_date
end_date
status
created_by
created_at
```

### Criteria

```text
criteria
--------
id
name
description
weight
status
```

### Votes

```text
votes
-----
id
campaign_id
voter_id
candidate_id
submitted_at
status
```

### Vote Scores

```text
vote_scores
-----------
id
vote_id
criterion_id
score
comment
```

### Winners

```text
winners
-------
id
campaign_id
employee_id
final_score
announced_at
```

### Recognition

```text
recognitions
------------
id
employee_id
campaign_id
message
created_by
created_at
```

### Audit Logs

```text
audit_logs
----------
id
user_id
action
entity
entity_id
old_value
new_value
ip_address
created_at
```

---

# 44. Recommended Technology Stack

### Frontend

**React / Next.js**

Advantages:

- Fast
- Responsive
- Modern UI
- Easy dashboard development
- Good component ecosystem

### Backend

Recommended options:

- **Node.js + NestJS/Express**
- **Django + Django REST Framework**

### Database

**PostgreSQL**

### Authentication

**Microsoft Entra ID + OpenID Connect**

### Authorization

**Microsoft Entra groups + application roles**

### Hosting

Possible options:

- Microsoft Azure
- AWS
- DigitalOcean
- Railway
- Render
- Secure VPS

If the organization already uses Microsoft 365/Azure, Azure hosting can simplify identity and infrastructure integration, although it is not mandatory.

---

# 45. Mobile Responsiveness

The system should be responsive.

Employees should be able to vote using:

- Desktop
- Laptop
- Tablet
- Mobile phone

The voting process should ideally take **less than two minutes**.

---

# 46. User Interface Structure

## Login

```text
-----------------------------------
       EMPLOYEE RECOGNITION
-----------------------------------

       Employee of the Month

       [ Sign in with Microsoft 365 ]

-----------------------------------
```

## Employee Dashboard

```text
-----------------------------------------
EMPLOYEE OF THE MONTH

Welcome, John

Current Campaign
September 2026

Voting Status: OPEN

[ VOTE NOW ]

-----------------------------------------

Your Recognition

Nominations: 4
Monthly Wins: 1
Annual Score: 88.7

-----------------------------------------

Previous Winner

August 2026
Mary Smith
Score: 92.4
-----------------------------------------
```

---

# 47. Voting Interface

The voting screen should use a simple step-by-step interface.

### Step 1

**Select Employee**

### Step 2

**Rate Performance**

### Step 3

**Review Vote**

### Step 4

**Submit**

This is preferable to presenting a large complicated form.

---

# 48. Admin Workflow

### Monthly Process

```text
Create Campaign
      ↓
Define Eligibility
      ↓
Open Voting
      ↓
Employees Vote
      ↓
Voting Closes
      ↓
System Validates Votes
      ↓
Scoring Engine Calculates Results
      ↓
Admin Reviews Results
      ↓
Winner Confirmed
      ↓
Winner Announced
      ↓
Results Added to Annual Statistics
```

---

# 49. Annual Workflow

```text
January
   ↓
Monthly Campaign
   ↓
February
   ↓
Monthly Campaign
   ↓
...
   ↓
December
   ↓
Annual Scores Calculated
   ↓
Annual Results Reviewed
   ↓
Employee of the Year
   ↓
Annual Recognition
```

---

# 50. Important Business Rules

The system should enforce the following:

1. An employee cannot vote for themselves.
2. An employee can only submit one valid vote per campaign.
3. A vote cannot be submitted after the campaign closes.
4. Only eligible active employees can vote.
5. Only eligible employees can receive votes.
6. Every criterion must have a defined weight.
7. All criterion weights must total 100%.

```text
30 + 40 + 15 + 15 = 100%
```

8. The system automatically calculates scores.
9. Results cannot be modified without an audit record.
10. Historical results must remain available.
11. Microsoft account passwords must never be stored in the application.
12. Application access must follow Microsoft account authorization and organizational roles.

---

# 51. Reporting

The platform should support report generation.

### Monthly Report

Should contain:

- Campaign name
- Voting period
- Eligible employees
- Total votes
- Participation rate
- Candidate scores
- Winner
- Criterion breakdown

### Annual Report

Should contain:

- Employee performance
- Monthly scores
- Average annual score
- Number of monthly wins
- Recognition history
- Annual winner

Reports should be exportable as:

- PDF
- Excel
- CSV

---

# 52. MVP — Minimum Viable Product

The first version should remain simple.

### Phase 1

Implement:

- Microsoft Active Directory / Entra ID SSO
- Employee automatic provisioning
- Employee profile synchronization
- Role-based access
- Employee login
- Employee management
- Departments
- Monthly campaigns
- Employee selection
- Four performance criteria
- Weighted scoring
- One vote per employee
- Automatic result calculation
- Monthly winner
- Winner history
- Annual score
- Admin dashboard
- Basic reports
- Audit logs

### Phase 2

Add:

- Email notifications
- Recognition comments
- Winner announcements
- Employee profiles
- Badges
- Advanced analytics
- Department analytics
- Microsoft Teams integration

### Phase 3

Add optional integrations:

- Microsoft 365
- Microsoft Teams
- Slack
- SMS
- HR systems
- HRIS integration

---

# 53. Recommended Dashboard Navigation

### Employee

```text
Dashboard
Vote
Recognition
My Performance
Previous Winners
Profile
Logout
```

### Administrator

```text
Dashboard
Employees
Departments
Campaigns
Voting Results
Winners
Analytics
Reports
Notifications
Audit Logs
Settings
Logout
```

---

# 54. Design Direction

The platform should feel like a **modern employee recognition portal**, not a complicated HR system.

### Design Principles

- Clean interface
- Large buttons
- Minimal forms
- Clear progress indicators
- Mobile-first voting
- Visual performance scores
- Employee profile photos
- Recognition cards
- Simple charts
- Clear winner presentation

The interface should use the organization's brand identity where applicable.

---

# 55. Example Monthly Experience

An employee logs in on September 15.

They see:

> **September Employee of the Month**  
> Voting closes in 15 days.

They click:

**Vote Now**

They select:

> Sarah Namukasa

They rate:

| Category | Rating |
|---|---:|
| Timeliness | 5 |
| Supporting Others | 5 |
| Interpersonal Skills | 4 |
| Innovation | 4 |

They add:

> "Sarah consistently helps the team resolve difficult issues and is always willing to support colleagues."

They click:

**Submit Vote**

The system confirms:

> **Your vote has been successfully submitted.**

The employee cannot submit another vote for that campaign.

---

# 56. Key Success Metrics

Management should be able to measure whether the platform is being adopted.

Important KPIs include:

### Participation Rate

```text
Votes Submitted
÷
Eligible Employees
× 100
```

### Monthly Participation

Track participation month-to-month.

### Department Participation

Identify departments with low engagement.

### Recognition Distribution

Track how recognition is distributed across departments.

### Performance Trends

Track changes in average scores over time.

---

# 57. Potential Future Features

The platform can eventually become a broader **Employee Recognition & Performance Platform**.

Possible future features:

- Peer-to-peer recognition
- Manager recognition
- Employee appreciation wall
- Achievement badges
- Team awards
- Department awards
- Quarterly awards
- Annual awards
- Goal tracking
- Performance reviews
- HR integration
- Payroll/HRIS integration
- AI-generated recognition summaries
- Sentiment analysis of recognition comments
- Automated monthly reports
- Digital certificates
- Winner certificates
- Employee recognition points/rewards

---

# 58. Final Product Vision

The ultimate goal is to create a platform where recognition becomes a normal part of the organization's culture.

The system should answer three questions every month:

### Who performed exceptionally?

**Employee of the Month**

### Why were they recognized?

Performance across:

- Timeliness
- Supporting Others
- Interpersonal Skills
- Innovation

### Who has demonstrated consistent excellence?

**Employee of the Year**

The platform should therefore combine **peer recognition, structured evaluation, weighted scoring, transparency, Microsoft SSO, and historical performance tracking** into one simple portal.

---

# 59. Recommended MVP Screens

The first development version should contain approximately these screens:

1. Microsoft Login
2. Employee Dashboard
3. Current Campaign
4. Employee Selection
5. Performance Evaluation
6. Vote Confirmation
7. Monthly Winner
8. Previous Winners
9. Employee Profile
10. Admin Dashboard
11. Employee Management
12. Campaign Management
13. Voting Results
14. Annual Performance
15. Reports
16. System Settings

---

# 60. Acceptance Criteria

The platform will be considered ready for deployment when:

- Employees can securely sign in using their organizational Microsoft/AD accounts.
- The application does not store employee Microsoft passwords.
- Administrators can manage employee records.
- Employee profiles can be synchronized from Microsoft Entra ID.
- Microsoft Entra groups can be mapped to application roles.
- Administrators can create monthly campaigns.
- Employees can select eligible colleagues.
- Employees can rate all four criteria.
- The system correctly applies 30%, 40%, 15% and 15% weights.
- Employees cannot vote for themselves.
- Employees cannot vote twice in the same campaign.
- Voting automatically closes at the configured deadline.
- The system calculates results automatically.
- Administrators can review results.
- A monthly winner can be confirmed and published.
- Historical winners are retained.
- Annual scores are calculated.
- The platform works on mobile and desktop.
- Voting data is protected.
- Important administrative actions are audited.
- Reports can be generated.
- Disabled organizational accounts cannot access the platform.
- MFA policies configured in Microsoft Entra ID are respected.

---

# 61. Final Authentication Requirement

The core authentication requirement is:

> **Employees must be able to access the Employee of the Month platform using their existing organizational Microsoft Active Directory/Microsoft Entra ID credentials through Single Sign-On. The platform must not require employees to create or maintain a separate password.**

This should be treated as a **mandatory system requirement**, rather than an optional future feature.

---

# 62. Recommended High-Level Architecture

```text
                         ORGANIZATION
                              │
                              ▼
                 ┌───────────────────────┐
                 │ Active Directory      │
                 │ / Microsoft Entra ID  │
                 └───────────┬───────────┘
                             │
                    SSO / OIDC / OAuth 2.0
                             │
                             ▼
                 ┌───────────────────────┐
                 │ Employee of the Month │
                 │       Frontend        │
                 │   React / Next.js     │
                 └───────────┬───────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │ Employee of the Month │
                 │        Backend        │
                 │ Node.js / Django      │
                 └───────────┬───────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │      PostgreSQL       │
                 │       Database        │
                 └───────────────────────┘
```

The system should be designed so that **identity and authentication remain under the organization's Microsoft identity infrastructure**, while the Employee of the Month platform manages voting, scoring, recognition, reporting, and historical performance data.
