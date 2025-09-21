import { GroupFilter, PaginatedResponse } from '../models/http.dto';

import { Group } from '../models/group.dto';
import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';
import { baseUrlAPI } from '../../config/config';

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private baseUrl = baseUrlAPI + 'group/';

  constructor(private restClient: RestClientService) {}

  getAllGroups(filter: GroupFilter): Promise<PaginatedResponse<Group>> {
    return this.restClient.get<PaginatedResponse<Group>>(
      this.baseUrl + 'all/',
      filter
    );
  }

  getGroupById(id: string): Promise<Group> {
    return this.restClient.get<Group>(this.baseUrl + id);
  }

  createGroup(group: Group): Promise<void> {
    return this.restClient.post(this.baseUrl, group);
  }

  updateGroup(id: string, group: Partial<Group>): Promise<void> {
    return this.restClient.patch(this.baseUrl + id, group);
  }

  deleteGroup(id: string): Promise<void> {
    return this.restClient.delete<void>(this.baseUrl + id);
  }
}
