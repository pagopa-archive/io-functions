import * as mongoose from "mongoose";

import { IProfile } from "../interfaces/profile";
import { FiscalCode } from "../utils/fiscalcode";

export interface IProfileModel extends IProfile, mongoose.Document { }

export class ProfileModel {
  private profileModel: mongoose.Model<IProfileModel>;

  constructor(profileModel: mongoose.Model<IProfileModel>) {
    this.profileModel = profileModel;
  }

  /**
   * Searches for one profile associated to the provided fiscal code
   *
   * @param fiscalCode
   */
  public findOneProfileByFiscalCode(fiscalCode: FiscalCode): Promise<IProfileModel | null> {
    return this.profileModel.collection.findOne({ fiscalCode });
  }

  public createOrUpdateProfile(profile: IProfile): Promise<IProfileModel | null> {
    return this.profileModel.findOneAndUpdate(
      { fiscalCode: profile.fiscalCode },
      profile,
      { upsert: true, new: true, runValidators: true },
    ).exec();
  }

}
