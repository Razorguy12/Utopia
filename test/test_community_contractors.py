from app.models.contractor import Contractor, ContractorScore
from app.models.issue import Issue


def citizen_token(client, name, email):
    response = client.post('/api/auth/citizen/register', json={
        'name': name, 'email': email, 'password': 'safe-test-password-123'
    })
    assert response.status_code == 200, response.text
    return {'Authorization': f"Bearer {response.json()['access_token']}"}


def test_confirmation_unique_undo_and_comment_does_not_create_issue(client, db_session):
    first = citizen_token(client, 'Resident One', 'one@example.test')
    second = citizen_token(client, 'Resident Two', 'two@example.test')
    issue = client.post('/api/issues', json={
        'kind': 'Drainage overflow', 'message': 'Overflowing water on the street',
        'locality': 'Triplicane', 'is_question': False,
    }, headers=first).json()
    assert client.post(f"/api/issues/{issue['id']}/confirmations", headers=first).status_code == 403
    assert client.post(f"/api/issues/{issue['id']}/confirmations", headers=second).json()['count'] == 1
    assert client.post(f"/api/issues/{issue['id']}/confirmations", headers=second).json()['count'] == 1
    assert client.delete(f"/api/issues/{issue['id']}/confirmations/me", headers=second).json()['count'] == 0
    before = db_session.query(Issue).count()
    response = client.post(f"/api/issues/{issue['id']}/comments", json={'comment':'This is happening on my street too.'}, headers=second)
    assert response.status_code == 200, response.text
    assert db_session.query(Issue).count() == before
    assert len(client.get(f"/api/issues/{issue['id']}/comments").json()) == 1


def test_anonymous_residents_can_confirm_and_comment_without_login(client, db_session):
    complainant = {'X-Community-ID': 'b56a0312-07ab-46dc-9ca5-78fb4b9c92a1'}
    resident = {'X-Community-ID': '2b79f1a1-d2ac-4637-86d4-f4ed218e9bf2'}
    issue_response = client.post('/api/issues', headers=complainant, json={
        'kind': 'Drainage overflow', 'message': 'Water is overflowing onto the street',
        'locality': 'Triplicane', 'is_question': False,
    })
    assert issue_response.status_code == 200, issue_response.text
    issue_id = issue_response.json()['id']
    assert client.post(f'/api/issues/{issue_id}/confirmations', headers=complainant).status_code == 403
    assert client.post(f'/api/issues/{issue_id}/confirmations', headers=resident).json()['count'] == 1
    assert client.post(f'/api/issues/{issue_id}/confirmations', headers=resident).json()['count'] == 1
    response = client.post(f'/api/issues/{issue_id}/comments', headers=resident, json={
        'comment': 'I experienced this on the same street yesterday.',
    })
    assert response.status_code == 200, response.text
    assert db_session.query(Issue).count() == 1


def test_official_complaint_decision_scores_once(client, db_session, make_project, auth_headers):
    project = make_project(department='Chennai Metro Water')
    contractor = Contractor(name=project.contractor, department=project.department, registration_number='TEST-C-1')
    db_session.add(contractor); db_session.flush()
    db_session.add(ContractorScore(contractor_id=contractor.id, current_score=100, current_grade='A+'))
    project.contractor_id = contractor.id
    issue = Issue(ref='CGI-TEST-001', project_id=project.id, kind='Road restoration', message='Major defect in restoration',
                  department=project.department, status='Submitted', severity='Major', locality=project.locality,
                  pincode=project.pincode, is_question=False)
    db_session.add(issue); db_session.commit()
    response = client.post(f'/api/issues/{issue.id}/verification', json={'decision':'Verified','note':'Inspection confirmed major failure.'}, headers=auth_headers)
    assert response.status_code == 200, response.text
    assert response.json()['scoring_triggered'] is True
    score = db_session.query(ContractorScore).filter_by(contractor_id=contractor.id).one()
    assert score.current_score == 93
    assert client.post(f'/api/issues/{issue.id}/verification', json={'decision':'Verified','note':'Inspection confirmed major failure.'}, headers=auth_headers).status_code == 409
    assert db_session.query(ContractorScore).filter_by(contractor_id=contractor.id).one().current_score == 93


def test_onsite_dashboard_returns_only_the_linked_score(client, db_session):
    contractor = Contractor(
        name='Field Account Contractor', department='GCC Roads & Bridges',
        registration_number='TEST-ONSITE-1', onsite_badge_id='GCC-FIELD-552',
    )
    db_session.add(contractor); db_session.flush()
    db_session.add(ContractorScore(contractor_id=contractor.id, current_score=87, current_grade='A'))
    db_session.commit()
    login = client.post('/api/auth/login', json={
        'employee_id': 'GCC-FIELD-552', 'password': 'field123',
    })
    assert login.status_code == 200, login.text
    response = client.get('/api/onsite/contractor-performance', headers={
        'Authorization': f"Bearer {login.json()['access_token']}",
    })
    assert response.status_code == 200, response.text
    assert len(response.json()['contractors']) == 1
    assert response.json()['contractors'][0]['score'] == 87
    assert response.json()['contractors'][0]['name'] == 'Field Account Contractor'
