import * as qs from 'qs';

import { EventEmitter, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';

import { Router } from '@angular/router';
import { baseUrlAPI } from '../../config/config';
import { firstValueFrom } from 'rxjs';

/**
 * Api is a generic REST API Service. Set your API url first.
 */
@Injectable({
  providedIn: 'root'
})
export class RestClientService {

  public offlineException: EventEmitter<HttpErrorResponse> = new EventEmitter();
  public serverErrorException: EventEmitter<HttpErrorResponse> = new EventEmitter();

  private readonly baseUrl = baseUrlAPI;

  constructor(
    private http: HttpClient,
    private router: Router,
  ) { }

  private getFullUrl(endpoint: string): string {
    if (endpoint.startsWith('http')) return endpoint;
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const path = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return `${base}${path}`;
  }

  private handleError(error: HttpErrorResponse, method: string) {
    console.error(`[${method}] error`, error);
    if (error.status === 401) {
      this.router.navigate(['']);
    } else if (error.status === 0) {
      this.offlineException.emit(error);
    } else if (error.status >= 500) {
      this.serverErrorException.emit(error);
    }
  }

  async get<T>(endpoint: string, params?: any, reqOpts?: any): Promise<T> {
    if (!reqOpts) reqOpts = { headers: new HttpHeaders() };
    const qsParams = qs.stringify(params, { skipNulls: true, addQueryPrefix: true });
    const url = this.getFullUrl(endpoint) + qsParams;

    return firstValueFrom(this.http.get(url, reqOpts)).catch(error => {
      this.handleError(error, 'GET');
      throw error;
    }) as unknown as Promise<T>;
  }

  async post(endpoint: string, body: any, httpParams?: HttpParams): Promise<any> {
    const reqOpts = { params: httpParams || new HttpParams(), headers: new HttpHeaders() };
    return firstValueFrom(this.http.post(this.getFullUrl(endpoint), body, reqOpts))
      .catch((error) => {
        this.handleError(error, 'POST');
        throw error;
      });
  }

  async postToAnotherEndpoint(endpoint: string, body: any, httpParams?: HttpParams): Promise<any> {
    return this.post(endpoint, body, httpParams);
  }

  async put(endpoint: string, body: any, httpParams?: HttpParams): Promise<any> {
    const reqOpts = { params: httpParams || new HttpParams(), headers: new HttpHeaders() };
    return firstValueFrom(this.http.put(this.getFullUrl(endpoint), body, reqOpts))
      .catch((error) => {
        this.handleError(error, 'PUT');
        throw error;
      });
  }

  async patch(endpoint: string, body: any, httpParams?: HttpParams): Promise<any> {
    const reqOpts = { params: httpParams || new HttpParams(), headers: new HttpHeaders() };
    return firstValueFrom(this.http.patch(this.getFullUrl(endpoint), body, reqOpts))
      .catch((error) => {
        this.handleError(error, 'PATCH');
        throw error;
      });
  }

  async delete<T>(endpoint: string, params?: any, reqOpts?: any): Promise<T> {
    if (!reqOpts) reqOpts = { params: new HttpParams(), headers: new HttpHeaders() };
    if (params) {
      for (let k in params) {
        if (params[k] != null) reqOpts.params = reqOpts.params.set(k, params[k]);
      }
    }

    return firstValueFrom(this.http.delete(this.getFullUrl(endpoint), reqOpts)).catch(error => {
      this.handleError(error, 'DELETE');
      throw error;
    }) as unknown as Promise<T>;
  }
}

